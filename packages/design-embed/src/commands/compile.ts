import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getBooleanFlag, getFormat, getStringFlag } from "../args.ts";
import { type DesignEmbedConfig, loadConfig } from "../config/index.ts";
import {
	checkGeneratedFiles,
	type Diagnostic,
	embed,
	formatDiagnosticText,
	type TargetEmitter,
	type TargetTestGenerator,
	toJsonDiagnostics,
} from "../core/index.ts";
import { htmlEmitter } from "../targets/html.ts";

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
	const generateTests = !getBooleanFlag(flags, "--no-test");
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

	const plugin = config?.source;
	if (!plugin) {
		diagnostics.push({
			code: "PLUGIN_REQUIRED",
			message:
				"Config must include a source plugin instance in the plugins array.",
			severity: "error",
		});
		printDiagnostics(diagnostics, format, quiet);
		return 2;
	}

	const pluginResult = await plugin.run({ cwd, args: {} });
	diagnostics.push(...pluginResult.diagnostics);

	if (hasErrors(diagnostics)) {
		printDiagnostics(diagnostics, format, quiet);
		return 2;
	}

	if (!pluginResult.html) {
		diagnostics.push({
			code: "PLUGIN_NO_HTML",
			message: "Source plugin produced no HTML.",
			severity: "error",
		});
		printDiagnostics(diagnostics, format, quiet);
		return 2;
	}

	const targetAdapter = getTargetAdapter(config);

	const cssPath = getStringFlag(flags, "--css");
	const html = pluginResult.html;
	const css = cssPath
		? readFileSync(resolve(cwd, cssPath), "utf-8")
		: pluginResult.css;
	const result = await embed({
		html,
		css,
		configPath,
		config,
		cwd,
		targetEmitter: targetAdapter.emitter,
	});
	diagnostics.push(...result.diagnostics);

	if (generateTests && targetAdapter.testGenerator) {
		const testResult = targetAdapter.testGenerator.generateTests({
			html,
			css,
			config: config ?? {},
			diagnostics,
			generatedFiles: result.files,
		});
		result.files.push(...testResult.files);
	}

	if (hasErrors(diagnostics)) {
		printDiagnostics(diagnostics, format, quiet);
		return 2;
	}

	if (options.check && !getBooleanFlag(flags, "--write")) {
		const checkResult = checkGeneratedFiles({
			cwd,
			files: result.files,
			readFile(path) {
				return existsSync(path) ? readFileSync(path, "utf-8") : undefined;
			},
		});
		const checkDiagnostics = checkResult.diagnostics;
		diagnostics.push(...checkDiagnostics);
		printDiagnostics(diagnostics, format, quiet);
		return checkResult.ok ? 0 : 3;
	}

	for (const file of result.files) {
		const outPath = resolve(cwd, file.path);
		mkdirSync(dirname(outPath), { recursive: true });
		writeFileSync(outPath, file.contents, "utf-8");
		if (!quiet && format === "text") {
			console.log(`Wrote ${file.path}`);
		}
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

interface ResolvedTargetAdapter {
	emitter: TargetEmitter;
	testGenerator?: TargetTestGenerator;
}

function getTargetAdapter(
	config: DesignEmbedConfig | undefined,
): ResolvedTargetAdapter {
	const target = config?.output?.target;
	if (!target || target === "html") {
		return { emitter: htmlEmitter };
	}
	return {
		emitter: target as TargetEmitter,
		testGenerator:
			"generateTests" in target
				? (target as TargetEmitter & TargetTestGenerator)
				: undefined,
	};
}

function hasErrors(diagnostics: Diagnostic[]): boolean {
	return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
