import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Diagnostic } from "../core/diagnostics/diagnostic.ts";
import type {
	SourcePlugin,
	SourcePluginInput,
	SourcePluginResult,
} from "../core/plugins/pluginApi.ts";
import type {
	ComponentMapping,
	DesignEmbedConfig,
	ResolvedSourceConfig,
	SnapshotConfig,
	SourceConfig,
	StyleMappings,
	TestGenerationConfig,
	TokenConfig,
} from "../core/types.ts";

export type { Diagnostic } from "../core/diagnostics/diagnostic.ts";

export interface LoadConfigResult {
	config?: DesignEmbedConfig;
	configPath?: string;
	diagnostics: Diagnostic[];
}

export interface ResolvedDesignEmbedConfig {
	output: {
		viewsDir: string;
		target: "html" | import("../core/types.ts").TargetEmitter;
		styleMode: import("../core/types.ts").StyleMode;
	};
	components: ComponentMapping[];
	tokens: TokenConfig;
	styleMappings: StyleMappings;
	tests: TestGenerationConfig;
	sources: ResolvedSourceConfig[];
}

export function resolveConfig(
	raw: DesignEmbedConfig,
	cwd: string,
): ResolvedDesignEmbedConfig {
	const sources = raw.sources ?? [];

	return {
		output: {
			viewsDir: resolveDir(raw.output?.viewsDir ?? "./src/views", cwd),
			target: raw.output?.target ?? "html",
			styleMode: raw.output?.styleMode ?? "inline",
		},
		components: raw.components ?? [],
		tokens: raw.tokens ?? {},
		styleMappings: raw.styleMappings ?? {},
		tests: resolveTestConfig(raw.tests),
		sources: sources.map((s) => resolveSourceConfig(s, raw, cwd)),
	};
}

function resolveSourceConfig(
	src: SourceConfig,
	global: DesignEmbedConfig,
	cwd: string,
): ResolvedSourceConfig {
	const viewsDir =
		src.output?.viewsDir ?? global.output?.viewsDir ?? "./src/views";
	return {
		plugin: src.plugin,
		output: {
			viewsDir: resolveDir(viewsDir, cwd),
			viewName: src.output?.viewName,
			target: src.output?.target ?? global.output?.target ?? "html",
			styleMode: src.output?.styleMode ?? global.output?.styleMode ?? "inline",
		},
		components: [...(global.components ?? []), ...(src.components ?? [])],
		tokens: mergeTokens(global.tokens, src.tokens),
		styleMappings: {
			...(global.styleMappings ?? {}),
			...(src.styleMappings ?? {}),
		},
		tests: resolveTestConfig({ ...global.tests, ...src.tests }),
		snapshot: resolveSnapshotConfig(src.snapshot, viewsDir, cwd),
	};
}

function resolveTestConfig(tests?: TestGenerationConfig): TestGenerationConfig {
	return {
		runner: tests?.runner ?? "playwright",
		viewports: tests?.viewports,
		states: tests?.states,
		assertions: {
			screenshot: tests?.assertions?.screenshot ?? true,
			layout: tests?.assertions?.layout,
			layoutTolerance: tests?.assertions?.layoutTolerance,
			selectors: tests?.assertions?.selectors,
			screenshotThreshold: tests?.assertions?.screenshotThreshold ?? 0.2,
			screenshotMaxDiffPixels:
				tests?.assertions?.screenshotMaxDiffPixels ?? 500,
		},
		outputDir: tests?.outputDir,
	};
}

function resolveSnapshotConfig(
	snap: SnapshotConfig | undefined,
	viewsDir: string | URL,
	cwd: string,
): Required<SnapshotConfig> {
	const resolvedViewsDir =
		viewsDir instanceof URL ? fileURLToPath(viewsDir) : resolve(cwd, viewsDir);
	return {
		mode: snap?.mode ?? "none",
		dir: snap?.dir ?? join(resolvedViewsDir, "__snapshots__"),
		format: snap?.format ?? "png",
		scale: snap?.scale ?? 1,
	};
}

function resolveDir(dir: string | URL, cwd: string): string {
	if (dir instanceof URL) return fileURLToPath(dir);
	return resolve(cwd, dir);
}

function mergeTokens(global?: TokenConfig, source?: TokenConfig): TokenConfig {
	return { ...(global ?? {}), ...(source ?? {}) };
}

export function defineConfig(config: DesignEmbedConfig): DesignEmbedConfig {
	return config;
}

export function fromFile(
	htmlPath: string | URL,
	cssPath?: string | URL,
): SourcePlugin {
	const resolvedHtml = htmlPath instanceof URL ? fileURLToPath(htmlPath) : null;
	const resolvedCss = cssPath
		? cssPath instanceof URL
			? fileURLToPath(cssPath)
			: null
		: null;
	return {
		name: "html-file",
		async run({ cwd }: SourcePluginInput): Promise<SourcePluginResult> {
			const html = readFileSync(
				resolvedHtml ?? resolve(cwd, htmlPath as string),
				"utf-8",
			);
			const css = cssPath
				? readFileSync(resolvedCss ?? resolve(cwd, cssPath as string), "utf-8")
				: undefined;
			return { html, css, diagnostics: [] };
		},
	};
}

export async function loadConfig(
	configPath: string,
	cwd = process.cwd(),
): Promise<LoadConfigResult> {
	const diagnostics: Diagnostic[] = [];
	const resolvedPath = isAbsolute(configPath)
		? configPath
		: resolve(cwd, configPath);

	if (!existsSync(resolvedPath)) {
		return {
			diagnostics: [
				{
					code: "CONFIG_NOT_FOUND",
					message: `Config file not found: ${resolvedPath}`,
					severity: "error",
				},
			],
		};
	}

	if (!/\.(ts|js|mjs)$/.test(resolvedPath)) {
		return {
			diagnostics: [
				{
					code: "CONFIG_UNSUPPORTED_FORMAT",
					message: `Unsupported config format: ${resolvedPath}. Only .ts, .js, and .mjs are supported.`,
					severity: "error",
				},
			],
		};
	}

	try {
		const module = await import(pathToFileURL(resolvedPath).href);
		const config = module.default ?? module.config;

		if (!config) {
			return {
				diagnostics: [
					{
						code: "CONFIG_INVALID",
						message: `Config file must export a default object or a named 'config' object: ${resolvedPath}`,
						severity: "error",
					},
				],
			};
		}

		diagnostics.push(...validateConfig(config));
		return { config, configPath: resolvedPath, diagnostics };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			diagnostics: [
				{
					code: "CONFIG_INVALID",
					message: `Failed to load config file: ${message}`,
					severity: "error",
				},
			],
		};
	}
}

export function validateConfig(config: DesignEmbedConfig): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];

	for (const [index, src] of (config.sources ?? []).entries()) {
		const srcTarget = src.output?.target;
		const srcStyleMode = src.output?.styleMode;
		if (
			srcTarget &&
			srcTarget !== "html" &&
			(typeof srcTarget !== "object" || typeof srcTarget.emit !== "function")
		) {
			diagnostics.push({
				code: "TARGET_ADAPTER_INVALID",
				message: `sources[${index}].output.target must be a target adapter with emit().`,
				severity: "error",
			});
		}
		if (
			srcStyleMode &&
			srcStyleMode !== "inline" &&
			srcStyleMode !== "css-modules" &&
			srcStyleMode !== "tailwind"
		) {
			diagnostics.push({
				code: "STYLE_MODE_UNSUPPORTED",
				message: `Unsupported style mode in sources[${index}]: ${srcStyleMode}`,
				severity: "error",
			});
		}
	}

	const target = config.output?.target;
	const styleMode = config.output?.styleMode;

	if (
		target &&
		target !== "html" &&
		(typeof target !== "object" || typeof target.emit !== "function")
	) {
		diagnostics.push({
			code: "TARGET_ADAPTER_INVALID",
			message: "output.target must be a target adapter with emit().",
			severity: "error",
		});
	}

	if (
		styleMode &&
		styleMode !== "inline" &&
		styleMode !== "css-modules" &&
		styleMode !== "tailwind"
	) {
		diagnostics.push({
			code: "STYLE_MODE_UNSUPPORTED",
			message: `Unsupported style mode: ${styleMode}`,
			severity: "error",
		});
	}

	for (const [index, component] of (config.components ?? []).entries()) {
		if (!component.selector || typeof component.selector !== "string") {
			diagnostics.push({
				code: "COMPONENT_SELECTOR_INVALID",
				message: `Component mapping ${index} must include a selector.`,
				severity: "error",
			});
		}

		if (!component.component || typeof component.component !== "string") {
			diagnostics.push({
				code: "COMPONENT_IMPORT_INVALID",
				message: `Component mapping ${index} must include a component name.`,
				severity: "error",
			});
		}
	}

	const spacing = config.tokens?.spacing;
	if (spacing?.unit && spacing.unit !== "px" && spacing.unit !== "rem") {
		diagnostics.push({
			code: "TOKEN_SPACING_UNIT_INVALID",
			message: `Unsupported spacing unit: ${spacing.unit}`,
			severity: "error",
		});
	}

	if (spacing?.threshold !== undefined && !Number.isFinite(spacing.threshold)) {
		diagnostics.push({
			code: "TOKEN_SPACING_THRESHOLD_INVALID",
			message: "Spacing threshold must be a finite number.",
			severity: "error",
		});
	}

	for (const [name, value] of Object.entries(spacing?.values ?? {})) {
		if (!Number.isFinite(value)) {
			diagnostics.push({
				code: "TOKEN_SPACING_VALUE_INVALID",
				message: `Spacing token ${name} must be a finite number.`,
				severity: "error",
			});
		}
	}

	for (const [name, value] of Object.entries(config.tokens?.colors ?? {})) {
		if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value)) {
			diagnostics.push({
				code: "TOKEN_COLOR_INVALID",
				message: `Color token ${name} must be a hex color.`,
				severity: "error",
			});
		}
	}

	if (
		config.tokens?.colorThreshold !== undefined &&
		!Number.isFinite(config.tokens.colorThreshold)
	) {
		diagnostics.push({
			code: "TOKEN_COLOR_THRESHOLD_INVALID",
			message: "Color threshold must be a finite number.",
			severity: "error",
		});
	}

	for (const [groupName, group] of Object.entries({
		sizing: config.tokens?.sizing,
		typography: config.tokens?.typography,
	})) {
		if (!group) {
			continue;
		}
		if (group.unit && group.unit !== "px" && group.unit !== "rem") {
			diagnostics.push({
				code: "TOKEN_NUMERIC_UNIT_INVALID",
				message: `Unsupported ${groupName} unit: ${group.unit}`,
				severity: "error",
			});
		}
		if (group.threshold !== undefined && !Number.isFinite(group.threshold)) {
			diagnostics.push({
				code: "TOKEN_NUMERIC_THRESHOLD_INVALID",
				message: `${groupName} threshold must be a finite number.`,
				severity: "error",
			});
		}
		for (const [name, value] of Object.entries(group.values ?? {})) {
			if (!Number.isFinite(value)) {
				diagnostics.push({
					code: "TOKEN_NUMERIC_VALUE_INVALID",
					message: `${groupName} token ${name} must be a finite number.`,
					severity: "error",
				});
			}
		}
	}

	validateTestGeneration(config.tests, diagnostics);

	return diagnostics;
}

function validateTestGeneration(
	tests: TestGenerationConfig | undefined,
	diagnostics: Diagnostic[],
): void {
	if (!tests) {
		return;
	}

	if (tests.runner && tests.runner !== "playwright") {
		diagnostics.push({
			code: "TEST_RUNNER_UNSUPPORTED",
			message: `Unsupported test runner: ${tests.runner}`,
			severity: "error",
		});
	}

	for (const [index, viewport] of (tests.viewports ?? []).entries()) {
		if (!Number.isFinite(viewport.width) || viewport.width <= 0) {
			diagnostics.push({
				code: "TEST_VIEWPORT_WIDTH_INVALID",
				message: `Test viewport ${index} width must be a positive finite number.`,
				severity: "error",
			});
		}
		if (!Number.isFinite(viewport.height) || viewport.height <= 0) {
			diagnostics.push({
				code: "TEST_VIEWPORT_HEIGHT_INVALID",
				message: `Test viewport ${index} height must be a positive finite number.`,
				severity: "error",
			});
		}
	}

	for (const [index, state] of (tests.states ?? []).entries()) {
		if (!state.name || typeof state.name !== "string") {
			diagnostics.push({
				code: "TEST_STATE_NAME_INVALID",
				message: `Test state ${index} must include a name.`,
				severity: "error",
			});
		}
	}

	if (
		tests.assertions?.layoutTolerance !== undefined &&
		(!Number.isFinite(tests.assertions.layoutTolerance) ||
			tests.assertions.layoutTolerance < 0)
	) {
		diagnostics.push({
			code: "TEST_LAYOUT_TOLERANCE_INVALID",
			message:
				"Test layout tolerance must be a finite number greater than or equal to 0.",
			severity: "error",
		});
	}
}
