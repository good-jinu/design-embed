// Config

export type { LoadConfigResult } from "./config/index.ts";
export {
	defineConfig,
	fromFile,
	loadConfig,
	validateConfig,
} from "./config/index.ts";
// Config schema types
// Diagnostics
// Extension types — for authoring source plugins and custom targets
export type {
	ComponentMapping,
	DesignEmbedConfig,
	DesignEmbedInput,
	DesignEmbedResult,
	DesignNode,
	Diagnostic,
	DiagnosticSeverity,
	GeneratedAsset,
	GeneratedFile,
	NumericTokenGroup,
	PropValue,
	SourceLocation,
	SourcePlugin,
	SourcePluginInput,
	SourcePluginResult,
	StyleMappings,
	StyleMode,
	TargetEmitInput,
	TargetEmitResult,
	TargetEmitter,
	TargetTestGenerateInput,
	TargetTestGenerateResult,
	TargetTestGenerator,
	TestAssertions,
	TestGenerationConfig,
	TestState,
	TestViewport,
	TokenConfig,
} from "./core/index.ts";
// Embed
// AST utilities and types — for custom target authors
export { applyComponentMappings, embed, parseHtml } from "./core/index.ts";
export type { HtmlTargetOptions } from "./targets/html.ts";
// Built-in HTML target
export { HtmlTarget, htmlTarget } from "./targets/html.ts";
