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
	const format = getFormat(flags);
	const diagnostics: Diagnostic[] = [];

	if (!configPath) {
		diagnostics.push({
			code: "CONFIG_REQUIRED",
			message:
				"No config file found. Create design-embed.config.ts or use --config.",
			severity: "error",
		});
		printDiagnostics(diagnostics, format, quiet);
		return 2;
	}

	const configResult = await loadConfig(configPath, cwd);
	diagnostics.push(...configResult.diagnostics);
	const config = configResult.config;

	if (hasErrors(diagnostics)) {
		printDiagnostics(diagnostics, format, quiet);
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
		printDiagnostics(diagnostics, format, quiet);
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
		printDiagnostics(diagnostics, format, quiet);
		return checkResult.ok ? 0 : 3;
	}

	printDiagnostics(diagnostics, format, quiet);
	if (!quiet && format === "text") {
		console.log(`Success. Generated ${result.files.length} file(s).`);
	}
	return 0;
}

export function printDiagnostics(
	diagnostics: Diagnostic[],
	format: "json" | "text",
	quiet: boolean,
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
	for (const diagnostic of diagnostics) {
		const output = formatDiagnosticText(diagnostic);
		if (diagnostic.severity === "error") {
			console.error(output);
		} else {
			console.warn(output);
		}
	}
}

function hasErrors(diagnostics: Diagnostic[]): boolean {
	return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
