import type {
	DesignEmbedConfig,
	DesignNode,
	Diagnostic,
	StyleMode,
} from "design-embed";
import { formatNumber, sortedEntries } from "./utils.ts";

export interface StyleTransformResult {
	nodes: DesignNode[];
	cssModule?: string;
	cssModulePath?: string;
}

interface CssRule {
	selector: string;
	declarations: Record<string, string>;
	order: number;
}

interface TokenMatch {
	group: string;
	name: string;
	value: string;
}

export interface ParsedSelector {
	tagName?: string;
	id?: string;
	classes: string[];
	attributes: Record<string, string>;
}

function parseInlineStyle(style: string | undefined): Record<string, string> {
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

function parseCssRules(
	css: string | undefined,
	diagnostics: Diagnostic[],
): CssRule[] {
	if (!css?.trim()) {
		return [];
	}
	const rules: CssRule[] = [];
	let order = 0;
	for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const selectorText = match[1]?.trim() ?? "";
		const declarations = parseInlineStyle(match[2]);
		for (const selector of selectorText.split(",").map((item) => item.trim())) {
			if (!selector) {
				continue;
			}
			if (!parseSelector(selector)) {
				diagnostics.push({
					code: "CSS_SELECTOR_UNSUPPORTED",
					message: `Unsupported CSS selector: ${selector}`,
					severity: "warning",
					selector,
				});
				continue;
			}
			rules.push({ selector, declarations, order });
			order += 1;
		}
	}
	const unsupported = css.replace(/([^{}]+)\{([^{}]*)\}/g, "").trim();
	if (unsupported) {
		diagnostics.push({
			code: "CSS_SELECTOR_UNSUPPORTED",
			message: "Unsupported CSS was ignored.",
			severity: "warning",
		});
	}
	return rules;
}

function resolveCssStyles(nodes: DesignNode[], rules: CssRule[]): DesignNode[] {
	return nodes.map((node) => {
		if (node.kind !== "element") {
			return node;
		}
		const matchedDeclarations = rules
			.filter((rule) => {
				const selector = parseSelector(rule.selector);
				return selector ? matchesSelector(node, selector) : false;
			})
			.sort((left, right) => left.order - right.order);
		const stylesFromCss: Record<string, string> = {};
		for (const rule of matchedDeclarations) {
			Object.assign(stylesFromCss, rule.declarations);
		}
		return {
			...node,
			styles: { ...stylesFromCss, ...(node.styles ?? {}) },
			children: resolveCssStyles(node.children ?? [], rules),
		};
	});
}

function mapStyleNodes(
	nodes: DesignNode[],
	mapper: (node: DesignNode) => DesignNode,
): DesignNode[] {
	return nodes.map((node) => {
		if (node.kind !== "element") {
			return node;
		}
		return mapper({
			...node,
			children: mapStyleNodes(node.children ?? [], mapper),
		});
	});
}

function snapStyleValues(
	styles: Record<string, string>,
	config: DesignEmbedConfig | undefined,
	diagnostics: Diagnostic[],
	node: DesignNode,
): Record<string, string> {
	const snapped: Record<string, string> = {};
	for (const [property, value] of sortedEntries(styles)) {
		const match = matchToken(property, value, config, diagnostics, node);
		snapped[property] = match?.value ?? value;
	}
	return snapped;
}

function applyTailwindStyles(
	node: DesignNode,
	config: DesignEmbedConfig | undefined,
	diagnostics: Diagnostic[],
): DesignNode {
	const remaining: Record<string, string> = {};
	const generatedClassNames = [...(node.generatedClassNames ?? [])];
	for (const [property, value] of sortedEntries(node.styles ?? {})) {
		const match = matchToken(property, value, config, diagnostics, node);
		if (!match) {
			remaining[property] = value;
			continue;
		}
		const className =
			config?.styleMappings?.[match.group]?.[
				`${property}:${match.group}.${match.name}`
			];
		if (className) {
			generatedClassNames.push(className);
		} else {
			remaining[property] = match.value;
			diagnostics.push({
				code: "TOKEN_NO_MATCH",
				message: `No Tailwind mapping for ${property}:${match.group}.${match.name}.`,
				severity: "info",
				source: node.source,
				property,
			});
		}
	}
	return {
		...node,
		styles: remaining,
		generatedClassNames,
	};
}

function emitCssModuleRule(
	className: string,
	styles: Record<string, string>,
): string {
	const declarations = sortedEntries(styles)
		.map(([property, value]) => `\t${property}: ${value};`)
		.join("\n");
	return `.${className} {\n${declarations}\n}`;
}

export function transformStyles(
	nodes: DesignNode[],
	css: string | undefined,
	config: (DesignEmbedConfig & { output?: { viewName?: string } }) | undefined,
	diagnostics: Diagnostic[],
	styleMode: StyleMode = "inline",
): StyleTransformResult {
	const cssRules = parseCssRules(css, diagnostics);
	const resolvedNodes = resolveCssStyles(nodes, cssRules);

	if (styleMode === "inline") {
		return {
			nodes: mapStyleNodes(resolvedNodes, (node) => ({
				...node,
				styles: snapStyleValues(node.styles ?? {}, config, diagnostics, node),
			})),
		};
	}

	if (styleMode === "tailwind") {
		return {
			nodes: mapStyleNodes(resolvedNodes, (node) =>
				applyTailwindStyles(node, config, diagnostics),
			),
		};
	}

	if (styleMode === "css-modules") {
		const rules: string[] = [];
		let index = 0;
		const moduleNodes = mapStyleNodes(resolvedNodes, (node) => {
			const snapped = snapStyleValues(
				node.styles ?? {},
				config,
				diagnostics,
				node,
			);
			if (Object.keys(snapped).length === 0) {
				return { ...node, styles: snapped };
			}
			index += 1;
			const className = `style${index}`;
			rules.push(emitCssModuleRule(className, snapped));
			return {
				...node,
				styles: {},
				generatedClassNames: [
					...(node.generatedClassNames ?? []),
					`module:${className}`,
				],
			};
		});
		const viewName = config?.output?.viewName ?? "DesignView";
		return {
			nodes: moduleNodes,
			cssModule: rules.length > 0 ? `${rules.join("\n\n")}\n` : undefined,
			cssModulePath: rules.length > 0 ? `${viewName}.module.css` : undefined,
		};
	}

	diagnostics.push({
		code: "STYLE_MODE_UNSUPPORTED",
		message: `Unsupported style mode: ${styleMode}`,
		severity: "error",
	});
	return { nodes: resolvedNodes };
}

const LAYOUT_PROPS = new Set([
	"display",
	"position",
	"top",
	"right",
	"bottom",
	"left",
	"flex-direction",
	"flex-wrap",
	"flex",
	"flex-grow",
	"flex-shrink",
	"flex-basis",
	"justify-content",
	"align-items",
	"align-self",
	"align-content",
	"box-sizing",
	"overflow",
	"overflow-x",
	"overflow-y",
	"opacity",
	"z-index",
	"font-family",
	"cursor",
	"pointer-events",
	"background-image",
	"background-repeat",
	"background-position",
	"background-size",
	"grid-template-columns",
	"grid-template-rows",
	"grid-column",
	"grid-row",
	"border",
]);

function tokenGroupForProperty(property: string): string | undefined {
	if (LAYOUT_PROPS.has(property)) {
		return "layout";
	}
	if (/^(margin|padding)(-|$)|^gap$|^row-gap$|^column-gap$/.test(property)) {
		return "spacing";
	}
	if (
		/^(width|height|min-width|min-height|max-width|max-height)$/.test(property)
	) {
		return "sizing";
	}
	if (/^(font-size|line-height|font-weight)$/.test(property)) {
		return "typography";
	}
	if (property === "border-radius") {
		return "radius";
	}
	if (property === "border-width") {
		return "borderWidth";
	}
	if (property === "box-shadow") {
		return "shadow";
	}
	if (
		property === "color" ||
		property === "background" ||
		property === "background-color" ||
		property === "border-color"
	) {
		return "colors";
	}
	return undefined;
}

function matchNumericToken(
	property: string,
	value: string,
	tokens: Record<string, number> | undefined,
	group: string,
	unit: "px" | "rem",
	threshold: number,
	diagnostics: Diagnostic[],
	node: DesignNode,
): TokenMatch | undefined {
	if (!tokens) {
		return undefined;
	}
	const parsed = value.match(/^(-?\d+(?:\.\d+)?)(px|rem)?$/);
	if (!parsed?.[1]) {
		return undefined;
	}
	const numericValue = Number(parsed[1]);
	const candidates = sortedEntries(tokens)
		.map(([name, tokenValue]) => ({
			name,
			tokenValue,
			distance: Math.abs(tokenValue - numericValue),
		}))
		.filter(({ distance }) => distance <= threshold)
		.sort(
			(left, right) =>
				left.distance - right.distance || left.name.localeCompare(right.name),
		);
	if (candidates.length === 0) {
		diagnostics.push({
			code: "TOKEN_NO_MATCH",
			message: `${property}: ${value} did not match a ${group} token.`,
			severity: "info",
			source: node.source,
			property,
		});
		return undefined;
	}
	if (
		candidates.length > 1 &&
		candidates[0]?.distance === candidates[1]?.distance
	) {
		diagnostics.push({
			code: "TOKEN_AMBIGUOUS_MATCH",
			message: `${property}: ${value} matches multiple ${group} tokens.`,
			severity: "error",
			source: node.source,
			property,
		});
		return undefined;
	}
	const candidate = candidates[0];
	if (!candidate) {
		return undefined;
	}
	return {
		group,
		name: candidate.name,
		value: `${formatNumber(candidate.tokenValue)}${unit}`,
	};
}

function parseColor(value: string): [number, number, number] | undefined {
	const trimmed = value.trim();
	const hex = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (hex?.[1]) {
		const expanded =
			hex[1].length === 3
				? hex[1]
						.split("")
						.map((part) => `${part}${part}`)
						.join("")
				: hex[1];
		return [
			Number.parseInt(expanded.slice(0, 2), 16),
			Number.parseInt(expanded.slice(2, 4), 16),
			Number.parseInt(expanded.slice(4, 6), 16),
		];
	}
	const rgb = trimmed.match(
		/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i,
	);
	if (rgb?.[1] && rgb[2] && rgb[3]) {
		return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
	}
	return undefined;
}

function colorDistance(
	left: [number, number, number],
	right: [number, number, number],
): number {
	return Math.sqrt(
		(left[0] - right[0]) ** 2 +
			(left[1] - right[1]) ** 2 +
			(left[2] - right[2]) ** 2,
	);
}

function normalizeHex(value: string): string {
	const color = parseColor(value);
	if (!color) {
		return value;
	}
	return `#${color.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function matchColorToken(
	property: string,
	value: string,
	config: DesignEmbedConfig | undefined,
	diagnostics: Diagnostic[],
	node: DesignNode,
): TokenMatch | undefined {
	const tokens = config?.tokens?.colors;
	if (!tokens) {
		return undefined;
	}
	const color = parseColor(value);
	if (!color) {
		diagnostics.push({
			code: "COLOR_PARSE_FAILED",
			message: `Could not parse color value: ${value}`,
			severity: "warning",
			source: node.source,
			property,
		});
		return undefined;
	}
	const threshold = config?.tokens?.colorThreshold ?? 0;
	const candidates = sortedEntries(tokens)
		.map(([name, tokenValue]) => {
			const tokenColor = parseColor(tokenValue);
			return tokenColor
				? { name, tokenValue, distance: colorDistance(color, tokenColor) }
				: undefined;
		})
		.filter(
			(
				candidate,
			): candidate is {
				name: string;
				tokenValue: string;
				distance: number;
			} => Boolean(candidate && candidate.distance <= threshold),
		)
		.sort(
			(left, right) =>
				left.distance - right.distance || left.name.localeCompare(right.name),
		);
	if (candidates.length === 0) {
		diagnostics.push({
			code: "TOKEN_NO_MATCH",
			message: `${property}: ${value} did not match a color token.`,
			severity: "info",
			source: node.source,
			property,
		});
		return undefined;
	}
	if (
		candidates.length > 1 &&
		candidates[0]?.distance === candidates[1]?.distance
	) {
		diagnostics.push({
			code: "TOKEN_AMBIGUOUS_MATCH",
			message: `${property}: ${value} matches multiple color tokens.`,
			severity: "error",
			source: node.source,
			property,
		});
		return undefined;
	}
	const candidate = candidates[0];
	if (!candidate) {
		return undefined;
	}
	return {
		group: "colors",
		name: candidate.name,
		value: normalizeHex(candidate.tokenValue),
	};
}

function matchStringToken(
	_property: string,
	value: string,
	tokens: Record<string, string> | undefined,
	group: string,
): TokenMatch | undefined {
	const match = sortedEntries(tokens ?? {}).find(
		([, tokenValue]) => tokenValue === value,
	);
	if (!match) {
		return undefined;
	}
	return { group, name: match[0], value: match[1] };
}

function matchToken(
	property: string,
	value: string,
	config: DesignEmbedConfig | undefined,
	diagnostics: Diagnostic[],
	node: DesignNode,
): TokenMatch | undefined {
	const group = tokenGroupForProperty(property);
	if (!group) {
		diagnostics.push({
			code: "STYLE_UNSUPPORTED_PROPERTY",
			message: `No token group is configured for CSS property "${property}".`,
			severity: "info",
			source: node.source,
			property,
		});
		return undefined;
	}
	if (group === "layout") {
		return undefined;
	}
	if (group === "colors") {
		return matchColorToken(property, value, config, diagnostics, node);
	}
	if (group === "shadow") {
		return matchStringToken(property, value, config?.tokens?.shadow, group);
	}
	const tokenValues =
		group === "spacing"
			? config?.tokens?.spacing?.values
			: group === "sizing"
				? config?.tokens?.sizing?.values
				: group === "typography"
					? config?.tokens?.typography?.values
					: group === "radius"
						? config?.tokens?.radius
						: config?.tokens?.borderWidth;
	const unit =
		group === "spacing"
			? (config?.tokens?.spacing?.unit ?? "px")
			: group === "sizing"
				? (config?.tokens?.sizing?.unit ?? "px")
				: group === "typography"
					? (config?.tokens?.typography?.unit ?? "px")
					: "px";
	const threshold =
		group === "spacing"
			? (config?.tokens?.spacing?.threshold ?? 0)
			: group === "sizing"
				? (config?.tokens?.sizing?.threshold ?? 0)
				: group === "typography"
					? (config?.tokens?.typography?.threshold ?? 0)
					: 0;
	return matchNumericToken(
		property,
		value,
		tokenValues,
		group,
		unit,
		threshold,
		diagnostics,
		node,
	);
}
