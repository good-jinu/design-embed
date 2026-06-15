import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { resolveConfig } from "../config/index.ts";
import { resolveSnapshotter } from "../snapshot/resolveSnapshotter.ts";
import { htmlTarget } from "../targets/html.ts";
import { detectComponents } from "./detect/index.ts";
import type { Diagnostic } from "./diagnostics/diagnostic.ts";
import type {
	DesignNode,
	ParsedSelector,
	PropValue,
	SourceLocation,
} from "./nodes.ts";
import type { GeneratedFile } from "./plugins/pluginApi.ts";
import { autoExtractTokens, mergeTokenConfigs } from "./tokens/autoExtract.ts";
import {
	TAILWIND_CLASS_MAPPINGS,
	TAILWIND_TOKEN_SCALE,
} from "./tokens/tailwindScale.ts";
import type {
	ComponentMapping,
	DesignEmbedConfig,
	ResolvedSourceConfig,
	StyleMappings,
	TargetEmitter,
	TargetTestGenerator,
} from "./types.ts";

export type {
	Diagnostic,
	DiagnosticSeverity,
} from "./diagnostics/diagnostic.ts";
export type { JsonDiagnostic } from "./diagnostics/jsonDiagnostic.ts";
export {
	formatDiagnosticText,
	toJsonDiagnostic,
	toJsonDiagnostics,
} from "./diagnostics/jsonDiagnostic.ts";
export type {
	DesignNode,
	ParsedSelector,
	PropValue,
	SourceLocation,
} from "./nodes.ts";
export type {
	CheckModeInput,
	CheckModeResult,
} from "./pipeline/checkMode.ts";
export { checkGeneratedFiles } from "./pipeline/checkMode.ts";
export type {
	GeneratedAsset,
	GeneratedFile,
	SourcePlugin,
	SourcePluginInput,
	SourcePluginResult,
	TargetEmitResult,
	TargetTestGenerateResult,
} from "./plugins/pluginApi.ts";
export type {
	ComponentMapping,
	DesignEmbedConfig,
	DesignSnapshotter,
	GlobalOutputConfig,
	NumericTokenGroup,
	ResolvedSourceConfig,
	SnapshotConfig,
	SnapshotInput,
	SnapshotMode,
	SnapshotResult,
	SourceConfig,
	SourceOutputConfig,
	StyleMappings,
	StyleMode,
	TargetEmitInput,
	TargetEmitter,
	TargetTestGenerateInput,
	TargetTestGenerator,
	TestAssertions,
	TestGenerationConfig,
	TestState,
	TestViewport,
	TokenConfig,
} from "./types.ts";

/**
 * Input for the core embed function.
 */
export interface DesignEmbedInput {
	/** The compiler configuration. */
	config?: DesignEmbedConfig;
	/** Working directory. */
	cwd?: string;
	/** When true, skips writing output files to disk. Defaults to false. */
	dryRun?: boolean;
	/** When true, generates test files alongside output files. Defaults to false. */
	generateTests?: boolean;
	/** Figma personal access token. Falls back to FIGMA_TOKEN env var. */
	figmaToken?: string;
}

/**
 * Result of the embedding process.
 */
export interface DesignEmbedResult {
	/** Source HTML resolved from the config's source plugin. */
	html: string;
	/** Source CSS resolved from the config's source plugin. */
	css?: string;
	/** Generated files. */
	files: GeneratedFile[];
	/** Diagnostics reported during compilation. */
	diagnostics: Diagnostic[];
}

/**
 * The main compiler entry point.
 * Parses HTML, applies component mappings, and emits files.
 *
 * @param input - The compilation input.
 * @returns A promise resolving to the compilation result.
 *
 */
export async function embed(
	input: DesignEmbedInput,
): Promise<DesignEmbedResult> {
	const cwd = input.cwd ?? process.cwd();
	const resolved = resolveConfig(input.config ?? { sources: [] }, cwd);

	if (resolved.sources.length === 0) {
		return {
			html: "",
			files: [],
			diagnostics: [
				{
					code: "PLUGIN_REQUIRED",
					message: "Config must include at least one source.",
					severity: "error",
				},
			],
		};
	}

	const allFiles: GeneratedFile[] = [];
	const allDiagnostics: Diagnostic[] = [];
	let lastHtml = "";
	let lastCss: string | undefined;

	for (const src of resolved.sources) {
		const result = await runSource(src, input, cwd);
		allFiles.push(...result.files);
		allDiagnostics.push(...result.diagnostics);
		lastHtml = result.html || lastHtml;
		lastCss = result.css ?? lastCss;
	}

	if (!input.dryRun) {
		for (const file of allFiles) {
			const outPath = resolve(cwd, file.path);
			mkdirSync(dirname(outPath), { recursive: true });
			writeFileSync(outPath, file.contents, "utf-8");
		}
	}

	return {
		html: lastHtml,
		css: lastCss,
		files: allFiles,
		diagnostics: allDiagnostics,
	};
}

async function runSource(
	src: ResolvedSourceConfig,
	input: DesignEmbedInput,
	cwd: string,
): Promise<{
	files: GeneratedFile[];
	diagnostics: Diagnostic[];
	html: string;
	css?: string;
}> {
	const sourceResult = await src.source.run({ cwd });
	const diagnostics = [...sourceResult.diagnostics];

	if (diagnostics.some((d) => d.severity === "error")) {
		return { files: [], diagnostics, html: "" };
	}

	if (!sourceResult.html) {
		return {
			files: [],
			diagnostics: [
				...diagnostics,
				{
					code: "PLUGIN_NO_HTML",
					message: "Source plugin produced no HTML.",
					severity: "error",
				},
			],
			html: "",
		};
	}

	const { html, css } = sourceResult;

	const mappingDiagnostics = validateComponentMappings(src.components);
	diagnostics.push(...mappingDiagnostics);

	if (diagnostics.some((d) => d.severity === "error")) {
		return { files: [], diagnostics, html };
	}

	const ast = parseHtml(html);
	const mappedNodes = applyComponentMappings(ast, src.components, diagnostics);
	const contentNodes = unwrapDocument(mappedNodes);
	const finalNodes = src.detect.enabled
		? detectComponents(
				contentNodes,
				src.detect,
				String(src.output.viewsDir),
				diagnostics,
			)
		: contentNodes;
	const mergedConfig = buildMergedConfig(src, contentNodes, css, cwd);

	const target = src.output.target;
	const targetObj =
		!target || target === "html" ? htmlTarget : (target as TargetEmitter);

	const { files } = targetObj.emit({
		nodes: finalNodes,
		css,
		config: mergedConfig,
		diagnostics,
	});

	const snapshotter = resolveSnapshotter(
		src,
		process.env.FIGMA_TOKEN ?? input.figmaToken,
	);

	let snapshotPath: string | null = null;
	if (snapshotter && src.snapshot.mode !== "headless") {
		try {
			const snapshotResult = await snapshotter.capture({
				source: sourceResult,
				config: src.snapshot,
				cwd,
			});
			snapshotPath = snapshotResult.filePath;
		} catch (err) {
			diagnostics.push({
				code: "SNAPSHOT_FAILED",
				message: `Snapshot capture failed: ${err instanceof Error ? err.message : String(err)}`,
				severity: "warning",
			});
		}
	}

	if (input.generateTests && "generateTests" in targetObj) {
		const testGen = targetObj as unknown as TargetTestGenerator;
		const testResult = testGen.generateTests({
			nodes: finalNodes,
			sourceNodes: ast,
			html,
			css,
			config: mergedConfig,
			snapshotPath,
		});
		diagnostics.push(...testResult.diagnostics);
		if (!diagnostics.some((d) => d.severity === "error")) {
			files.push(...testResult.files);
		}
	}

	return { files, diagnostics, html, css };
}

function buildMergedConfig(
	src: ResolvedSourceConfig,
	nodes: DesignNode[],
	css: string | undefined,
	cwd: string,
): DesignEmbedConfig {
	const resolvedTarget = src.output.target;
	const targetStyleMode =
		typeof resolvedTarget === "object" && resolvedTarget !== null
			? (resolvedTarget.styleMode ?? "inline")
			: "inline";
	const isTailwind = targetStyleMode === "tailwind";
	const extracted = autoExtractTokens(nodes, css);
	const baseTokens = isTailwind ? TAILWIND_TOKEN_SCALE : extracted;
	const mergedTokens = mergeTokenConfigs(baseTokens, src.tokens);

	let mergedStyleMappings: StyleMappings;
	if (isTailwind) {
		mergedStyleMappings = { ...TAILWIND_CLASS_MAPPINGS };
		for (const [group, entries] of Object.entries(src.styleMappings)) {
			mergedStyleMappings[group] = {
				...(mergedStyleMappings[group] ?? {}),
				...entries,
			};
		}
	} else {
		mergedStyleMappings = src.styleMappings;
	}

	// viewsDir in ResolvedSourceConfig is absolute; targets use it as a file-path
	// prefix, so we convert it back to relative-from-cwd so GeneratedFile.path
	// remains relative (consistent with how callers snapshot-compare files).
	const viewsDir =
		typeof src.output.viewsDir === "string"
			? relative(cwd, src.output.viewsDir)
			: src.output.viewsDir;

	return {
		output: { ...src.output, viewsDir },
		components: src.components,
		tokens: mergedTokens,
		styleMappings: mergedStyleMappings,
		tests: src.tests,
		snapshot: src.snapshot,
	};
}

export function applyComponentMappings(
	nodes: DesignNode[],
	mappings: ComponentMapping[],
	diagnostics: Diagnostic[] = [],
): DesignNode[] {
	const parsedMappings = mappings
		.map((mapping, index) => ({
			index,
			mapping,
			selector: parseSelector(mapping.selector),
		}))
		.filter(({ selector }) => selector !== undefined) as Array<{
		index: number;
		mapping: ComponentMapping;
		selector: ParsedSelector;
	}>;

	return nodes.map((node) => {
		if (node.kind !== "element") {
			return node;
		}

		const match = parsedMappings.find(({ selector }) =>
			matchesSelector(node, selector),
		);
		if (match) {
			const props = extractProps(node, match.mapping, diagnostics);
			return {
				kind: "component",
				component: match.mapping.component,
				importName: match.mapping.component,
				importPath: `./${match.mapping.component}.view`,
				props,
				children:
					props.children?.kind === "children"
						? undefined
						: applyComponentMappings(
								node.children ?? [],
								mappings,
								diagnostics,
							),
				source: node.source,
				sourceElement: node,
			};
		}

		return {
			...node,
			children: applyComponentMappings(
				node.children ?? [],
				mappings,
				diagnostics,
			),
		};
	});
}

export function parseSelector(selector: string): ParsedSelector | undefined {
	const trimmed = selector.trim();
	if (!trimmed || /[\s>+~,:]/.test(trimmed)) {
		return undefined;
	}

	const parsed: ParsedSelector = { classes: [], attributes: {} };
	let rest = trimmed;
	const tagMatch = rest.match(/^[a-zA-Z][a-zA-Z0-9-]*/);
	if (tagMatch?.[0]) {
		parsed.tagName = tagMatch[0].toLowerCase();
		rest = rest.slice(tagMatch[0].length);
	}

	while (rest) {
		if (rest.startsWith(".")) {
			const match = rest.match(/^\.([a-zA-Z_][a-zA-Z0-9_-]*)/);
			if (!match?.[1]) {
				return undefined;
			}
			parsed.classes.push(match[1]);
			rest = rest.slice(match[0].length);
			continue;
		}

		if (rest.startsWith("#")) {
			const match = rest.match(/^#([a-zA-Z_][a-zA-Z0-9_-]*)/);
			if (!match?.[1] || parsed.id) {
				return undefined;
			}
			parsed.id = match[1];
			rest = rest.slice(match[0].length);
			continue;
		}

		if (rest.startsWith("[")) {
			const match = rest.match(
				/^\[([a-zA-Z_][a-zA-Z0-9_.:-]*)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]+)))?\]/,
			);
			if (!match?.[1]) {
				return undefined;
			}
			parsed.attributes[match[1]] = match[2] ?? match[3] ?? match[4] ?? "";
			rest = rest.slice(match[0].length);
			continue;
		}

		return undefined;
	}

	return parsed;
}

export function matchesSelector(
	node: DesignNode,
	selector: ParsedSelector,
): boolean {
	if (node.kind !== "element") {
		return false;
	}
	const attributes = node.attributes ?? {};
	if (selector.tagName && node.tagName !== selector.tagName) {
		return false;
	}
	if (selector.id && attributes.id !== selector.id) {
		return false;
	}
	const classNames = new Set(
		(attributes.class ?? "").split(/\s+/).filter(Boolean),
	);
	for (const className of selector.classes) {
		if (!classNames.has(className)) {
			return false;
		}
	}
	for (const [name, value] of Object.entries(selector.attributes)) {
		if (!(name in attributes)) {
			return false;
		}
		if (value !== "" && attributes[name] !== value) {
			return false;
		}
	}

	return true;
}

export function parseHtml(html: string): DesignNode[] {
	const root: DesignNode = {
		kind: "element",
		tagName: "root",
		attributes: {},
		styles: {},
		children: [],
	};
	const stack = [root];
	const tokens = html.matchAll(
		/<!--[\s\S]*?-->|<![A-Za-z][^>]*>|<\/?[a-zA-Z][^>]*>|[^<]+/g,
	);

	for (const token of tokens) {
		const value = token[0];
		const offset = token.index;
		const source = getSourceLocation(html, offset);

		if (value.startsWith("<!--") || value.startsWith("<!")) {
			continue;
		}

		if (value.startsWith("</")) {
			const tagName = value.slice(2, -1).trim().toLowerCase();
			while (stack.length > 1) {
				const node = stack.pop();
				if (node?.tagName === tagName) {
					break;
				}
			}
			continue;
		}

		if (value.startsWith("<")) {
			const selfClosing = /\/>$/.test(value) || isVoidElement(value);
			const node = parseElement(value, source);
			currentParent(stack).children?.push(node);
			if (!selfClosing) {
				stack.push(node);
			}
			continue;
		}

		if (value.trim()) {
			currentParent(stack).children?.push({
				kind: "text",
				text: decodeHtmlEntities(collapseWhitespace(value)),
				source,
			});
		}
	}

	return root.children ?? [];
}

/**
 * Figma exports are full HTML documents, but `<html>`, `<head>`, and `<body>`
 * are invalid at a component root (React/Vue/VanJS) and render differently when
 * mounted than as a standalone page. Strip the document wrapper and return the
 * `<body>`'s direct children so a component target emits a fragment that matches
 * the reference page's rendered content. Document metadata in `<head>` is
 * intentionally dropped — visual tests do not need it. Inputs that are already
 * fragments (no document wrapper) are returned unchanged.
 *
 * Component targets should call this; standalone-page targets (e.g. the HTML
 * target, whose output is loaded as a full page) should not.
 */
export function unwrapDocument(nodes: DesignNode[]): DesignNode[] {
	const body = findBodyNode(nodes);
	return body ? (body.children ?? []) : nodes;
}

function findBodyNode(nodes: DesignNode[]): DesignNode | undefined {
	for (const node of nodes) {
		if (node.kind !== "element") {
			continue;
		}
		if (node.tagName === "body") {
			return node;
		}
		if (node.tagName === "html") {
			const body = findBodyNode(node.children ?? []);
			if (body) {
				return body;
			}
		}
	}
	return undefined;
}

export function parseInlineStyle(
	style: string | undefined,
): Record<string, string> {
	const styles: Record<string, string> = {};
	if (!style) {
		return styles;
	}

	for (const declaration of style.split(";")) {
		const [property, ...valueParts] = declaration.split(":");
		const value = valueParts.join(":").trim();
		if (!property?.trim() || !value) {
			continue;
		}
		styles[property.trim().toLowerCase()] = value;
	}

	return styles;
}

function parseElement(rawTag: string, source: SourceLocation): DesignNode {
	const tagBody = rawTag.replace(/^</, "").replace(/\/?>$/, "").trim();
	const tagName = tagBody.split(/\s+/, 1)[0]?.toLowerCase() ?? "div";
	const attributeSource = tagBody.slice(tagName.length).trim();
	const attributes = parseAttributes(attributeSource);
	const styles = parseInlineStyle(attributes.style);

	return {
		kind: "element",
		tagName,
		attributes,
		styles,
		children: [],
		source,
	};
}

function parseAttributes(source: string): Record<string, string> {
	const attributes: Record<string, string> = {};
	const attributePattern =
		/([:@a-zA-Z_][:@a-zA-Z0-9_.-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

	for (const match of source.matchAll(attributePattern)) {
		const name = match[1];
		if (!name) {
			continue;
		}

		attributes[name] = decodeHtmlEntities(
			match[3] ?? match[4] ?? match[5] ?? "",
		);
	}

	return attributes;
}

/**
 * Parsed values must hold the actual characters, not their HTML escapes —
 * targets re-escape on emission. Without this, an escaped quote inside a
 * style attribute (e.g. font-family: &quot;Pretendard&quot;) leaks its
 * trailing semicolon into the declaration splitter and corrupts the value.
 */
function decodeHtmlEntities(value: string): string {
	return value
		.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
		.replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
			String.fromCodePoint(Number.parseInt(code, 16)),
		)
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}

function validateComponentMappings(mappings: ComponentMapping[]): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	for (const [index, mapping] of mappings.entries()) {
		if (mapping.selector && !parseSelector(mapping.selector)) {
			diagnostics.push({
				code: "SELECTOR_UNSUPPORTED",
				message: `Component mapping ${index} uses an unsupported selector: ${mapping.selector}`,
				severity: "error",
			});
		}

		for (const [propName, expression] of Object.entries(mapping.props ?? {})) {
			if (!isSupportedPropExpression(expression)) {
				diagnostics.push({
					code: "PROP_EXPRESSION_UNSUPPORTED",
					message: `Component mapping ${index} prop "${propName}" uses an unsupported expression: ${expression}`,
					severity: "error",
				});
			}
		}
	}
	return diagnostics;
}

function isSupportedPropExpression(expression: string): boolean {
	return (
		!expression.startsWith("$") ||
		expression === "$text" ||
		expression === "$children" ||
		/^\$attr\.[a-zA-Z_][a-zA-Z0-9_.:-]*$/.test(expression)
	);
}

function extractProps(
	node: DesignNode,
	mapping: ComponentMapping,
	diagnostics: Diagnostic[],
): Record<string, PropValue> {
	const props: Record<string, PropValue> = {};
	for (const [propName, expression] of Object.entries(mapping.props ?? {})) {
		if (expression === "$text") {
			props[propName] = { kind: "text", value: collectText(node) };
			continue;
		}

		if (expression === "$children") {
			props[propName] = { kind: "children", value: node.children ?? [] };
			continue;
		}

		if (expression.startsWith("$attr.")) {
			const attributeName = expression.slice("$attr.".length);
			const value = node.attributes?.[attributeName];
			if (value === undefined) {
				diagnostics.push({
					code: "PROP_ATTRIBUTE_MISSING",
					message: `Attribute "${attributeName}" is missing for prop "${propName}".`,
					severity: "warning",
				});
				continue;
			}
			props[propName] = {
				kind: "literal",
				value,
				attribute: attributeName,
			};
			continue;
		}

		props[propName] = { kind: "literal", value: expression };
	}
	return props;
}

function collectText(node: DesignNode): string {
	if (node.kind === "text") {
		return node.text ?? "";
	}
	return (node.children ?? [])
		.map((child) => collectText(child))
		.filter(Boolean)
		.join(" ")
		.trim();
}

function currentParent(stack: DesignNode[]): DesignNode {
	const parent = stack[stack.length - 1];
	if (!parent) {
		throw new Error("HTML parser stack is empty.");
	}
	return parent;
}

function getSourceLocation(source: string, offset: number): SourceLocation {
	const before = source.slice(0, offset);
	const lines = before.split(/\r?\n/);
	return {
		offset,
		line: lines.length,
		column: (lines[lines.length - 1]?.length ?? 0) + 1,
	};
}

function collapseWhitespace(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function isVoidElement(tag: string): boolean {
	return /^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)(\s|>|\/)/i.test(
		tag,
	);
}
