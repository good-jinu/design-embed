import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getBooleanFlag, getFormat, getStringFlag } from "../args.ts";
import { loadConfig } from "../config/index.ts";
import {
	checkGeneratedFiles,
	type Diagnostic,
	embed,
	formatDiagnosticText,
	toJsonDiagnostics,
} from "../core/index.ts";

export interface CompileCommandOptions {
	check?: boolean;
}

export async function runCompileCommand(
	flags: Record<string, string | boolean>,
	options: CompileCommandOptions = {},
): Promise<number> {
	const cwd = resolve(process.cwd(), getStringFlag(flags, "--cwd") ?? ".");
	const explicitConfigPath = getStringFlag(flags, "--config");
	const defaultConfigPath = resolve(cwd, "design-embed.config.ts");
	const configPath =
		explicitConfigPath ??
		(existsSync(defaultConfigPath) ? "design-embed.config.ts" : undefined);
	const quiet = getBooleanFlag(flags, "--quiet");
	const verbose = getBooleanFlag(flags, "--verbose");
	const format = getFormat(flags);
	const diagnostics: Diagnostic[] = [];

	if (!configPath) {
		diagnostics.push({
			code: "CONFIG_REQUIRED",
			message:
				"No config file found. Create design-embed.config.ts or use --config.",
			severity: "error",
		});
		printDiagnostics(diagnostics, format, quiet, verbose);
		return 2;
	}

	const configResult = await loadConfig(configPath, cwd);
	diagnostics.push(...configResult.diagnostics);
	const config = configResult.config;

	if (hasErrors(diagnostics)) {
		printDiagnostics(diagnostics, format, quiet, verbose);
		return 2;
	}

	const isCheckMode = options.check && !getBooleanFlag(flags, "--write");
	const generateTests = !getBooleanFlag(flags, "--no-test");

	const result = await embed({
		config,
		cwd,
		dryRun: isCheckMode,
		generateTests,
	});
	diagnostics.push(...result.diagnostics);

	if (hasErrors(diagnostics)) {
		printDiagnostics(diagnostics, format, quiet, verbose);
		return 2;
	}

	if (isCheckMode) {
		const checkResult = checkGeneratedFiles({
			cwd,
			files: result.files,
			readFile(path) {
				return existsSync(path) ? readFileSync(path, "utf-8") : undefined;
			},
		});
		diagnostics.push(...checkResult.diagnostics);
		printDiagnostics(diagnostics, format, quiet, verbose);
		return checkResult.ok ? 0 : 3;
	}

	printDiagnostics(diagnostics, format, quiet, verbose);
	if (!quiet && format === "text") {
		console.log(`Success. Generated ${result.files.length} file(s).`);
	}
	return 0;
}

export function printDiagnostics(
	diagnostics: Diagnostic[],
	format: "json" | "text",
	quiet: boolean,
	verbose = false,
): void {
	if (format === "json") {
		console.log(
			JSON.stringify({ diagnostics: toJsonDiagnostics(diagnostics) }, null, 2),
		);
		return;
	}
	if (quiet) {
		return;
	}
	// `info` diagnostics are high-volume, low-signal (e.g. one TOKEN_NO_MATCH per
	// unmapped style). They drown out warnings and errors, so collapse them into
	// a per-code summary unless the user opts into the full list with --verbose.
	const suppressed = new Map<string, number>();
	for (const diagnostic of diagnostics) {
		if (!verbose && diagnostic.severity === "info") {
			suppressed.set(
				diagnostic.code,
				(suppressed.get(diagnostic.code) ?? 0) + 1,
			);
			continue;
		}
		const output = formatDiagnosticText(diagnostic);
		if (diagnostic.severity === "error") {
			console.error(output);
		} else {
			console.warn(output);
		}
	}
	for (const [code, count] of suppressed) {
		console.warn(
			`info: ${code}: ${count} occurrence(s) suppressed. Re-run with --verbose to list them.`,
		);
	}
}

export function hasErrors(diagnostics: Diagnostic[]): boolean {
	return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
