import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Minimal interface every source plugin instance must satisfy.
 * Keep this interface in the config package so plugin packages can implement
 * it without pulling in the heavier core package.
 */
export interface PluginDefinition {
	readonly name: string;
}

/**
 * External target adapter instance supplied by packages like
 * `@design-embed/target-react`.
 */
export interface TargetAdapterDefinition {
	readonly name?: string;
	emit(input: unknown): unknown;
	generateTests?(input: unknown): unknown;
}

/**
 * A diagnostic reported during configuration loading or validation.
 */
export interface ConfigDiagnostic {
	/** Unique error code. */
	code: string;
	/** Human-readable message. */
	message: string;
	/** Severity of the issue. */
	severity: "error" | "warning" | "info";
}

/**
 * The root configuration object for design-embed.
 */
export interface DesignEmbedConfig {
	/** Output settings for the generated code. */
	output?: {
		/** Directory where generated views will be written. */
		viewsDir?: string;
		/** Directory for page-level assemblies. */
		assembliesDir?: string;
		/** Target adapter instance. Omit to use built-in HTML output. */
		target?: "html" | TargetAdapterDefinition;
		/** Name of the generated component/view. */
		viewName?: string;
		/** How to handle styles: inline, Tailwind, or CSS Modules. */
		styleMode?: StyleMode;
	};
	/** Mappings from HTML selectors to project components. */
	components?: ComponentMapping[];
	/** Design token scales for style snapping. */
	tokens?: TokenConfig;
	/** Mappings for Tailwind utility classes. */
	styleMappings?: StyleMappings;
	/** Source plugin instances to run when fetching HTML with `design-embed --out`. */
	plugins?: PluginDefinition[];
	/** Visual and layout test generation settings. */
	tests?: TestGenerationConfig;
}

/**
 * Configuration for generated regression tests.
 */
export interface TestGenerationConfig {
	/** Directory where generated test files and reference fixtures are written. */
	outputDir?: string;
	/** Test runner emitted by the generator. */
	runner?: "playwright";
	/** Source artifact paths used as the visual/layout reference. */
	source?: {
		/** Path to the reference design HTML, relative to the config directory or cwd. */
		html?: string;
		/** Optional path to external reference CSS, relative to the config directory or cwd. */
		css?: string;
	};
	/** Viewports to verify. */
	viewports?: TestViewport[];
	/** Interaction states to verify for every viewport. */
	states?: TestState[];
	/** Assertion settings. */
	assertions?: TestAssertions;
}

export interface TestViewport {
	/** Stable viewport name used in test titles. */
	name?: string;
	width: number;
	height: number;
}

export interface TestState {
	/** Stable state name used in test titles. */
	name: string;
	/** Selector to hover before assertions. */
	hover?: string;
	/** Selector to focus before assertions. */
	focus?: string;
	/** Selector to click before assertions. */
	click?: string;
	/** Selector to wait for before assertions. */
	waitFor?: string;
}

export interface TestAssertions {
	/** Whether to compare full-page screenshots. Defaults to true. */
	screenshot?: boolean;
	/** Whether to compare element bounding boxes. Defaults to true. */
	layout?: boolean;
	/** Maximum x/y/width/height drift in CSS pixels. Defaults to 0. */
	layoutTolerance?: number;
	/** Selectors to collect for layout comparison. Defaults to [":scope", ":scope *"]. */
	selectors?: string[];
}

/**
 * Available styling modes.
 */
export type StyleMode = "inline" | "css-modules" | "tailwind";

/**
 * Defines how to map a design element to a project component.
 */
export interface ComponentMapping {
	/** CSS selector to match the element in the design HTML. */
	selector: string;
	/** Import path of the project component. */
	component: string;
	/** Named export of the component. */
	importName?: string;
	/** Prop values to pass, supports $text, $children, and $attr expressions. */
	props?: Record<string, string>;
}

/**
 * Configuration for design tokens.
 */
export interface TokenConfig {
	/** Spacing scale (e.g. padding, margin, gap). */
	spacing?: {
		/** Unit to use in generated styles. */
		unit?: "px" | "rem";
		/** Max distance for value snapping. */
		threshold?: number;
		/** The token scale mapping names to values. */
		values?: Record<string, number>;
	};
	/** Sizing scale (e.g. width, height). */
	sizing?: NumericTokenGroup;
	/** Typography scale (e.g. font-size, line-height). */
	typography?: NumericTokenGroup;
	/** Border radius scale. */
	radius?: Record<string, number>;
	/** Border width scale. */
	borderWidth?: Record<string, number>;
	/** Box shadow scale. */
	shadow?: Record<string, string>;
	/** Color palette. */
	colors?: Record<string, string>;
	/** Color matching threshold (CIE76). */
	colorThreshold?: number;
}

export interface NumericTokenGroup {
	unit?: "px" | "rem";
	threshold?: number;
	values?: Record<string, number>;
}

export type StyleMappings = Record<string, Record<string, string>>;

/**
 * Result of loading a configuration file.
 */
export interface LoadConfigResult {
	/** The loaded and validated config, if successful. */
	config?: DesignEmbedConfig;
	/** Any errors or warnings encountered during loading. */
	diagnostics: ConfigDiagnostic[];
}

/**
 * Helper to define configuration with type safety.
 *
 * @param config - The configuration object.
 * @returns The same configuration object.
 *
 * @example
 * export default defineConfig({
 *   output: { target: reactTarget }
 * });
 */
export function defineConfig(config: DesignEmbedConfig): DesignEmbedConfig {
	return config;
}

/**
 * Asynchronously loads a configuration file from disk.
 * Supports .ts, .js, and .mjs files via dynamic import.
 *
 * @param configPath - Path to the config file.
 * @param cwd - Current working directory.
 * @returns A promise resolving to the load result.
 */
export async function loadConfig(
	configPath: string,
	cwd = process.cwd(),
): Promise<LoadConfigResult> {
	const diagnostics: ConfigDiagnostic[] = [];
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
		return { config, diagnostics };
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

export function validateConfig(config: DesignEmbedConfig): ConfigDiagnostic[] {
	const diagnostics: ConfigDiagnostic[] = [];
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
				message: `Component mapping ${index} must include a component path.`,
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
	diagnostics: ConfigDiagnostic[],
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
