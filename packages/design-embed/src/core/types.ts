import type { Diagnostic } from "./diagnostics/diagnostic.ts";
import type { DesignNode } from "./nodes.ts";
import type {
	GeneratedFile,
	SourcePlugin,
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
	name?: string;
	emit(input: TargetEmitInput): TargetEmitResult;
}

export interface TargetTestGenerateInput {
	html: string;
	css?: string;
	config: DesignEmbedConfig;
	diagnostics: Diagnostic[];
	generatedFiles?: GeneratedFile[];
}

export interface TargetTestGenerator {
	generateTests(input: TargetTestGenerateInput): TargetTestGenerateResult;
}

// ---------------------------------------------------------------------------
// Configuration types
// ---------------------------------------------------------------------------

export type StyleMode = "inline" | "css-modules" | "tailwind";

export interface ComponentMapping {
	selector: string;
	component: string;
	importName?: string;
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
	source?: {
		html?: string;
		css?: string;
	};
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
}

export interface DesignEmbedConfig {
	output?: {
		viewsDir?: string;
		assembliesDir?: string;
		target?: "html" | TargetEmitter;
		viewName?: string;
		styleMode?: StyleMode;
	};
	components?: ComponentMapping[];
	tokens?: TokenConfig;
	styleMappings?: StyleMappings;
	source?: SourcePlugin;
	tests?: TestGenerationConfig;
}
