import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { type DesignEmbedConfig, loadConfig } from "@design-embed/config";
import {
	checkGeneratedFiles,
	type Diagnostic,
	embed,
	formatDiagnosticText,
	type TargetEmitter,
	type TargetTestGenerator,
	type TransformerPlugin,
	toJsonDiagnostics,
} from "@design-embed/core";
import { getBooleanFlag, getFormat, getStringFlag } from "../args.ts";
import { htmlEmitter } from "../targets/html.ts";

export interface CompileCommandOptions {
	check?: boolean;
}

export async function runCompileCommand(
	flags: Record<string, string | boolean>,
	options: CompileCommandOptions = {},
): Promise<number> {
	const cwd = resolve(process.cwd(), getStringFlag(flags, "--cwd") ?? ".");
	const inputPath =
		getStringFlag(flags, "--input") ?? getStringFlag(flags, "--");
	const explicitConfigPath = getStringFlag(flags, "--config");
	const defaultConfigPath = resolve(cwd, "design-embed.config.ts");
	const configPath =
		explicitConfigPath ??
		(existsSync(defaultConfigPath) ? "design-embed.config.ts" : undefined);
	const quiet = getBooleanFlag(flags, "--quiet");
	const format = getFormat(flags);
	const generateTests = !getBooleanFlag(flags, "--no-test");
	const diagnostics: Diagnostic[] = [];

	if (!inputPath) {
		diagnostics.push({
			code: "INPUT_REQUIRED",
			message: "--input is required.",
			severity: "error",
		});
		printDiagnostics(diagnostics, format, quiet);
		return 2;
	}

	const resolvedInputPath = resolve(cwd, inputPath);
	if (!existsSync(resolvedInputPath)) {
		diagnostics.push({
			code: "INPUT_NOT_FOUND",
			message: `Input file not found: ${resolvedInputPath}`,
			severity: "error",
			file: inputPath,
		});
		printDiagnostics(diagnostics, format, quiet);
		return 2;
	}

	let config: DesignEmbedConfig | undefined;
	let transformers: TransformerPlugin[] = [];
	if (configPath) {
		const configResult = await loadConfig(configPath, cwd);
		diagnostics.push(...configResult.diagnostics);
		config = configResult.config;

		if (hasErrors(diagnostics)) {
			printDiagnostics(diagnostics, format, quiet);
			return 2;
		}

		transformers = await loadTransformers(config, configPath, cwd, diagnostics);
		if (hasErrors(diagnostics)) {
			printDiagnostics(diagnostics, format, quiet);
			return 2;
		}
	}

	const targetAdapter = getTargetAdapter(config);

	const cssPath = getStringFlag(flags, "--css");
	const html = readFileSync(resolvedInputPath, "utf-8");
	const css = cssPath
		? readFileSync(resolve(cwd, cssPath), "utf-8")
		: undefined;
	const result = await embed({
		html,
		css,
		configPath,
		config,
		cwd,
		transformers,
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

function isPackageName(path: string): boolean {
	return !path.startsWith(".") && !isAbsolute(path);
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

async function loadTransformers(
	config: DesignEmbedConfig | undefined,
	configPath: string,
	cwd: string,
	diagnostics: Diagnostic[],
): Promise<TransformerPlugin[]> {
	const configDir = dirname(resolve(cwd, configPath));
	const loaded: TransformerPlugin[] = [];

	for (const transformer of config?.transformers ?? []) {
		const specifier = isPackageName(transformer.path)
			? transformer.path
			: isAbsolute(transformer.path)
				? transformer.path
				: resolve(configDir, transformer.path);
		try {
			const module = await import(specifier);
			const plugin = module.default ?? module.transformer;
			if (!plugin?.transform) {
				diagnostics.push({
					code: "TRANSFORMER_INVALID",
					message: `Transformer ${transformer.path} must export a plugin object with transform().`,
					severity: "error",
					file: transformer.path,
				});
				continue;
			}
			loaded.push({
				name: plugin.name ?? transformer.path,
				order: transformer.order ?? plugin.order,
				transform: plugin.transform,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			diagnostics.push({
				code: "TRANSFORMER_LOAD_FAILED",
				message: `Failed to load transformer ${transformer.path}: ${message}`,
				severity: "error",
				file: transformer.path,
			});
		}
	}

	return loaded;
}

function hasErrors(diagnostics: Diagnostic[]): boolean {
	return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
