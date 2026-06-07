import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { htmlTarget } from "../targets/html.ts";
import type { Diagnostic } from "./diagnostics/diagnostic.ts";
import type {
	DesignNode,
	ParsedSelector,
	PropValue,
	SourceLocation,
} from "./nodes.ts";
import type { GeneratedFile } from "./plugins/pluginApi.ts";
import type {
	ComponentMapping,
	DesignEmbedConfig,
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
	NumericTokenGroup,
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

	if (!input.config?.source) {
		return {
			html: "",
			files: [],
			diagnostics: [
				{
					code: "PLUGIN_REQUIRED",
					message: "Config must include a source plugin.",
					severity: "error",
				},
			],
		};
	}

	const sourceResult = await input.config.source.run({ cwd });
	const diagnostics = [...sourceResult.diagnostics];

	if (diagnostics.some((d) => d.severity === "error")) {
		return { html: "", files: [], diagnostics };
	}

	if (!sourceResult.html) {
		return {
			html: "",
			files: [],
			diagnostics: [
				...diagnostics,
				{
					code: "PLUGIN_NO_HTML",
					message: "Source plugin produced no HTML.",
					severity: "error",
				},
			],
		};
	}

	const html = sourceResult.html;
	const css = sourceResult.css;

	const config = patchOutputPaths(input.config as DesignEmbedConfig, cwd);

	const target = config?.output?.target;
	const targetObj =
		!target || target === "html" ? htmlTarget : (target as TargetEmitter);

	const mappingDiagnostics = validateComponentMappings(
		config?.components ?? [],
	);
	diagnostics.push(...mappingDiagnostics);

	if (diagnostics.some((d) => d.severity === "error")) {
		return { html, files: [], diagnostics };
	}

	const ast = parseHtml(html);
	const mappedNodes = applyComponentMappings(
		ast,
		config?.components ?? [],
		diagnostics,
	);

	const { files } = targetObj.emit({
		nodes: mappedNodes,
		css,
		config,
		diagnostics,
	});

	if (input.generateTests && "generateTests" in targetObj) {
		const testGen = targetObj as unknown as TargetTestGenerator;
		const testResult = testGen.generateTests({ html, css, config });
		diagnostics.push(...testResult.diagnostics);
		if (!diagnostics.some((d) => d.severity === "error")) {
			files.push(...testResult.files);
		}
	}

	if (!input.dryRun) {
		for (const file of files) {
			const outPath = resolve(cwd, file.path);
			mkdirSync(dirname(outPath), { recursive: true });
			writeFileSync(outPath, file.contents, "utf-8");
		}
	}

	return { html, css, files, diagnostics };
}

function patchOutputPaths(
	config: DesignEmbedConfig,
	cwd: string,
): DesignEmbedConfig {
	const viewsDir = config.output?.viewsDir;
	if (!viewsDir) return config;
	return {
		...config,
		output: { ...config.output, viewsDir: resolveDir(viewsDir, cwd) },
	};
}

function resolveDir(
	dir: string | URL | undefined,
	cwd: string,
): string | undefined {
	if (!dir) return undefined;
	if (dir instanceof URL) return relative(cwd, fileURLToPath(dir));
	return dir;
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
				text: collapseWhitespace(value),
				source,
			});
		}
	}

	return root.children ?? [];
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

		attributes[name] = match[3] ?? match[4] ?? match[5] ?? "";
	}

	return attributes;
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
