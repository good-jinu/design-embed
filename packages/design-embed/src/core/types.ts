import type { Diagnostic } from "./diagnostics/diagnostic.ts";
import type { DesignNode } from "./nodes.ts";
import type {
	SourcePlugin,
	SourcePluginResult,
	TargetEmitResult,
	TargetTestGenerateResult,
} from "./plugins/pluginApi.ts";

// ---------------------------------------------------------------------------
// Target adapter interfaces
// ---------------------------------------------------------------------------

export interface TargetEmitInput {
	nodes: DesignNode[];
	css?: string;
	config?: DesignEmbedConfig;
	diagnostics: Diagnostic[];
}

export interface TargetEmitter {
	emit(input: TargetEmitInput): TargetEmitResult;
}

export interface TargetTestGenerateInput {
	nodes: DesignNode[];
	sourceNodes: DesignNode[];
	html: string;
	css?: string;
	config: DesignEmbedConfig;
	/** Absolute path to the baseline snapshot PNG, or null if disabled. */
	snapshotPath: string | null;
}

export interface TargetTestGenerator {
	generateTests(input: TargetTestGenerateInput): TargetTestGenerateResult;
}

// ---------------------------------------------------------------------------
// Configuration types
// ---------------------------------------------------------------------------

export type StyleMode = "inline" | "css-modules" | "tailwind";

export interface GlobalOutputConfig {
	/** Default: './src/views' */
	viewsDir?: string | URL;
	/** Default: 'html' */
	target?: "html" | TargetEmitter;
	/** Default: 'inline' */
	styleMode?: StyleMode;
	/** @deprecated Move to per-source SourceOutputConfig.viewName. */
	viewName?: string;
}

export interface SourceOutputConfig {
	viewsDir?: string | URL;
	viewName?: string;
	target?: "html" | TargetEmitter;
	styleMode?: StyleMode;
}

export type SnapshotMode = "figma-api" | "headless" | "none";

export interface SnapshotConfig {
	mode?: SnapshotMode;
	/** Default: alongside viewsDir in '__snapshots__' */
	dir?: string;
	/** Default: 'png' */
	format?: "png" | "jpeg";
	/** Default: 1 */
	scale?: number;
}

export interface SourceConfig {
	plugin: SourcePlugin;
	output?: SourceOutputConfig;
	components?: ComponentMapping[];
	tokens?: TokenConfig;
	styleMappings?: StyleMappings;
	tests?: TestGenerationConfig;
	snapshot?: SnapshotConfig;
}

export interface DesignSnapshotter {
	capture(input: SnapshotInput): Promise<SnapshotResult>;
}

export interface SnapshotInput {
	source: SourcePluginResult;
	config: SnapshotConfig;
	cwd: string;
}

export interface SnapshotResult {
	filePath: string;
	width: number;
	height: number;
}

export interface ResolvedSourceConfig {
	plugin: SourcePlugin;
	output: Required<Pick<SourceOutputConfig, "target" | "styleMode">> &
		SourceOutputConfig;
	components: ComponentMapping[];
	tokens: TokenConfig;
	styleMappings: StyleMappings;
	tests: TestGenerationConfig;
	snapshot: Required<SnapshotConfig>;
}

export interface ComponentMapping {
	selector: string;
	component: string;
	props?: Record<string, string>;
}

export interface TokenConfig {
	spacing?: {
		unit?: "px" | "rem";
		threshold?: number;
		values?: Record<string, number>;
	};
	sizing?: NumericTokenGroup;
	typography?: NumericTokenGroup;
	radius?: Record<string, number>;
	borderWidth?: Record<string, number>;
	shadow?: Record<string, string>;
	colors?: Record<string, string>;
	colorThreshold?: number;
}

export interface NumericTokenGroup {
	unit?: "px" | "rem";
	threshold?: number;
	values?: Record<string, number>;
}

export type StyleMappings = Record<string, Record<string, string>>;

export interface TestGenerationConfig {
	outputDir?: string;
	runner?: "playwright";
	viewports?: TestViewport[];
	states?: TestState[];
	assertions?: TestAssertions;
}

export interface TestViewport {
	name?: string;
	width: number;
	height: number;
}

export interface TestState {
	name: string;
	hover?: string;
	focus?: string;
	click?: string;
	waitFor?: string;
}

export interface TestAssertions {
	screenshot?: boolean;
	layout?: boolean;
	layoutTolerance?: number;
	selectors?: string[];
	/**
	 * Per-pixel color sensitivity (0-1) for the screenshot comparison. Smaller
	 * is stricter. Defaults to 0.2.
	 */
	screenshotThreshold?: number;
	/**
	 * Maximum number of differing pixels tolerated in the screenshot
	 * comparison. Defaults to 0 (byte-exact).
	 */
	screenshotMaxDiffPixels?: number;
}

export interface DesignEmbedConfig {
	output?: GlobalOutputConfig;
	components?: ComponentMapping[];
	tokens?: TokenConfig;
	styleMappings?: StyleMappings;
	tests?: TestGenerationConfig;
	sources?: SourceConfig[];
	/** @deprecated Use sources[].plugin instead. Will be removed in next major version. */
	source?: SourcePlugin;
}
