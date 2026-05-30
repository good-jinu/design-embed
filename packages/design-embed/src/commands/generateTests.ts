import { resolve } from "node:path";
import { getBooleanFlag, getFormat, getStringFlag } from "../args.ts";
import { type DesignEmbedConfig, loadConfig } from "../config/index.ts";
import { type Diagnostic, embed } from "../core/index.ts";
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

	if (!getTestGenerator(config)) {
		diagnostics.push({
			code: "TEST_TARGET_UNSUPPORTED",
			message:
				"generate-tests requires output.target to be a target adapter with generateTests().",
			severity: "error",
		});
		printDiagnostics(diagnostics, format, quiet);
		return 2;
	}

	const result = await embed({ config, cwd, generateTests: true });
	diagnostics.push(...result.diagnostics);
	if (hasErrors(diagnostics)) {
		printDiagnostics(diagnostics, format, quiet);
		return 2;
	}

	printDiagnostics(diagnostics, format, quiet);
	if (!quiet && format === "text") {
		console.log(`Success. Generated ${result.files.length} test file(s).`);
	}
	return 0;
}

function getTestGenerator(config: DesignEmbedConfig): boolean {
	const target = config.output?.target;
	return !!(target && target !== "html" && "generateTests" in target);
}

function hasErrors(diagnostics: Diagnostic[]): boolean {
	return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
