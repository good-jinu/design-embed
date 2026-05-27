import type { DesignEmbedConfig } from "../../../config/src/index.ts";
import type { Diagnostic } from "../diagnostics/diagnostic.ts";
import type { DesignNode, GeneratedFile } from "../index.ts";

export interface GeneratedAsset {
	path: string;
	contents?: string | Uint8Array;
	sourceUrl?: string;
}

export interface SourcePlugin {
	name: string;
	run(input: SourcePluginInput): Promise<SourcePluginResult>;
}

export interface SourcePluginInput {
	cwd: string;
	args: Record<string, string | boolean>;
	config?: unknown;
}

export interface SourcePluginResult {
	html?: string;
	css?: string;
	assets?: GeneratedAsset[];
	files?: GeneratedFile[];
	diagnostics: Diagnostic[];
}

export interface TargetEmitInput {
	nodes: DesignNode[];
	css?: string;
	config?: DesignEmbedConfig;
	diagnostics: Diagnostic[];
}

export interface TargetEmitResult {
	files: GeneratedFile[];
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

export interface TargetTestGenerateResult {
	files: GeneratedFile[];
}

export interface TargetTestGenerator {
	generateTests(input: TargetTestGenerateInput): TargetTestGenerateResult;
}
