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
export { PluginRegistry } from "./plugins/pluginRegistry.ts";
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
	/** The source design HTML. */
	html: string;
	/** Optional external CSS. */
	css?: string;
	/** Optional path to the config file (for resolution). */
	configPath?: string;
	/** The compiler configuration. */
	config?: DesignEmbedConfig;
	/** Working directory. */
	cwd?: string;
	/** The target emitter to use. */
	targetEmitter: TargetEmitter;
}

/**
 * Result of the embedding process.
 */
export interface DesignEmbedResult {
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
 * @example
 * const result = await embed({
 *   html: '<div class="btn">Click me</div>',
 *   config: myConfig,
 *   targetEmitter: reactEmitter
 * });
 */
export async function embed(
	input: DesignEmbedInput,
): Promise<DesignEmbedResult> {
	const ast = parseHtml(input.html);
	const diagnostics = validateComponentMappings(input.config?.components ?? []);

	if (diagnostics.some((d) => d.severity === "error")) {
		return { files: [], diagnostics };
	}

	const mappedNodes = applyComponentMappings(
		ast,
		input.config?.components ?? [],
		diagnostics,
	);

	const { files } = input.targetEmitter.emit({
		nodes: mappedNodes,
		css: input.css,
		config: input.config,
		diagnostics,
	});

	return { files, diagnostics };
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
				component: match.mapping.importName ?? inferImportName(match.mapping),
				importName: match.mapping.importName ?? inferImportName(match.mapping),
				importPath: match.mapping.component,
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
	const tokens = html.matchAll(/<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|[^<]+/g);

	for (const token of tokens) {
		const value = token[0];
		const offset = token.index;
		const source = getSourceLocation(html, offset);

		if (value.startsWith("<!--")) {
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
			props[propName] = { kind: "literal", value };
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

function inferImportName(mapping: ComponentMapping): string {
	const lastSegment = mapping.component.split("/").filter(Boolean).at(-1);
	return mapping.importName ?? lastSegment ?? "Component";
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
