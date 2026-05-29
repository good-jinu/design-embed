import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { getBooleanFlag, getFormat, getStringFlag } from "../args.ts";
import { type DesignEmbedConfig, loadConfig } from "../config/index.ts";
import type { Diagnostic, TargetTestGenerator } from "../core/index.ts";
import { printDiagnostics } from "./compile.ts";

export async function runGenerateTestsCommand(
	flags: Record<string, string | boolean>,
): Promise<number> {
	const cwd = resolve(process.cwd(), getStringFlag(flags, "--cwd") ?? ".");
	const configPath =
		getStringFlag(flags, "--config") ?? "design-embed.config.ts";
	const quiet = getBooleanFlag(flags, "--quiet");
	const format = getFormat(flags);
	const diagnostics: Diagnostic[] = [];

	const configResult = await loadConfig(configPath, cwd);
	diagnostics.push(...configResult.diagnostics);
	const config = configResult.config;
	if (!config || hasErrors(diagnostics)) {
		printDiagnostics(diagnostics, format, quiet);
		return 2;
	}

	const source = readConfiguredSource(config, configPath, cwd, diagnostics);
	if (!source || hasErrors(diagnostics)) {
		printDiagnostics(diagnostics, format, quiet);
		return 2;
	}

	const testGenerator = getTestGenerator(config);
	if (!testGenerator) {
		diagnostics.push({
			code: "TEST_TARGET_UNSUPPORTED",
			message:
				"generate-tests requires output.target to be a target adapter with generateTests().",
			severity: "error",
		});
		printDiagnostics(diagnostics, format, quiet);
		return 2;
	}

	const result = testGenerator.generateTests({
		html: source.html,
		css: source.css,
		config,
		diagnostics,
	});
	if (hasErrors(diagnostics)) {
		printDiagnostics(diagnostics, format, quiet);
		return 2;
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
		console.log(`Success. Generated ${result.files.length} test file(s).`);
	}
	return 0;
}

interface SourceContents {
	html: string;
	css?: string;
}

function readConfiguredSource(
	config: DesignEmbedConfig,
	configPath: string,
	cwd: string,
	diagnostics: Diagnostic[],
): SourceContents | undefined {
	const source = config.tests?.source;
	if (!source?.html) {
		diagnostics.push({
			code: "TEST_SOURCE_HTML_REQUIRED",
			message: "tests.source.html is required for generate-tests.",
			severity: "error",
		});
		return undefined;
	}

	const configDir = dirname(resolve(cwd, configPath));
	const htmlPath = resolveConfigPath(source.html, configDir);
	if (!existsSync(htmlPath)) {
		diagnostics.push({
			code: "TEST_SOURCE_HTML_NOT_FOUND",
			message: `Test source HTML not found: ${htmlPath}`,
			severity: "error",
			file: source.html,
		});
		return undefined;
	}

	let css: string | undefined;
	if (source.css) {
		const cssPath = resolveConfigPath(source.css, configDir);
		if (!existsSync(cssPath)) {
			diagnostics.push({
				code: "TEST_SOURCE_CSS_NOT_FOUND",
				message: `Test source CSS not found: ${cssPath}`,
				severity: "error",
				file: source.css,
			});
			return undefined;
		}
		css = readFileSync(cssPath, "utf-8");
	}

	return {
		html: readFileSync(htmlPath, "utf-8"),
		css,
	};
}

function resolveConfigPath(path: string, configDir: string): string {
	return isAbsolute(path) ? path : resolve(configDir, path);
}

function getTestGenerator(
	config: DesignEmbedConfig,
): TargetTestGenerator | undefined {
	const target = config.output?.target;
	return target && target !== "html" && "generateTests" in target
		? (target as TargetTestGenerator)
		: undefined;
}

function hasErrors(diagnostics: Diagnostic[]): boolean {
	return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
