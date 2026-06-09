import type { DesignNode } from "../nodes.ts";
import type { TokenConfig } from "../types.ts";

const SPACING_PROP = /^(margin|padding)(-|$)|^gap$|^row-gap$|^column-gap$/;
const SIZING_PROP =
	/^(width|height|min-width|min-height|max-width|max-height)$/;
const TYPOGRAPHY_PROP = /^font-size$/;
const COLOR_PROP = /^(color|background-color|border-color|background)$/;

export function autoExtractTokens(
	nodes: DesignNode[],
	css: string | undefined,
): TokenConfig {
	const spacing = new Map<string, number>();
	const sizing = new Map<string, number>();
	const typography = new Map<string, number>();
	const radius = new Map<string, number>();
	const borderWidth = new Map<string, number>();
	const shadow = new Map<string, string>();
	const colors = new Map<string, string>();

	function addPxValue(target: Map<string, number>, value: string) {
		const match = value.match(/^(\d+(?:\.\d+)?)px$/);
		if (!match?.[1]) return;
		const name = match[1];
		target.set(name, Number(name));
	}

	function addColor(value: string) {
		const hex = parseColorToHex(value);
		if (hex) colors.set(hex.slice(1).toLowerCase(), hex);
	}

	function processStyle(property: string, value: string) {
		if (SPACING_PROP.test(property)) {
			addPxValue(spacing, value);
		} else if (SIZING_PROP.test(property)) {
			addPxValue(sizing, value);
		} else if (TYPOGRAPHY_PROP.test(property)) {
			addPxValue(typography, value);
		} else if (property === "border-radius") {
			addPxValue(radius, value);
		} else if (property === "border-width") {
			addPxValue(borderWidth, value);
		} else if (property === "box-shadow") {
			const key = value.replace(/\s+/g, " ").trim();
			shadow.set(key, key);
		} else if (COLOR_PROP.test(property)) {
			addColor(value);
		}
	}

	function walkNodes(nodeList: DesignNode[]) {
		for (const node of nodeList) {
			if (node.kind === "element" && node.styles) {
				for (const [property, value] of Object.entries(node.styles)) {
					processStyle(property, value);
				}
			}
			if (node.children) walkNodes(node.children);
		}
	}

	walkNodes(nodes);

	if (css) {
		for (const ruleMatch of css.matchAll(/[^{}]+\{([^{}]*)\}/g)) {
			const declarations = ruleMatch[1] ?? "";
			for (const decl of declarations.split(";")) {
				const colonIdx = decl.indexOf(":");
				if (colonIdx === -1) continue;
				const property = decl.slice(0, colonIdx).trim().toLowerCase();
				const value = decl.slice(colonIdx + 1).trim();
				if (property && value) processStyle(property, value);
			}
		}
	}

	const result: TokenConfig = {};
	if (spacing.size > 0)
		result.spacing = { values: Object.fromEntries(spacing) };
	if (sizing.size > 0) result.sizing = { values: Object.fromEntries(sizing) };
	if (typography.size > 0)
		result.typography = { values: Object.fromEntries(typography) };
	if (radius.size > 0) result.radius = Object.fromEntries(radius);
	if (borderWidth.size > 0)
		result.borderWidth = Object.fromEntries(borderWidth);
	if (shadow.size > 0) result.shadow = Object.fromEntries(shadow);
	if (colors.size > 0) result.colors = Object.fromEntries(colors);
	return result;
}

function parseColorToHex(value: string): string | undefined {
	const trimmed = value.trim();
	const hex = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (hex?.[1]) {
		const expanded =
			hex[1].length === 3
				? hex[1]
						.split("")
						.map((c) => `${c}${c}`)
						.join("")
				: hex[1];
		return `#${expanded.toLowerCase()}`;
	}
	const rgb = trimmed.match(
		/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i,
	);
	if (rgb?.[1] && rgb[2] && rgb[3]) {
		return `#${[Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
			.map((n) => n.toString(16).padStart(2, "0"))
			.join("")}`;
	}
	return undefined;
}

export function mergeTokenConfigs(
	base: TokenConfig,
	override: TokenConfig,
): TokenConfig {
	return {
		spacing: override.spacing ?? base.spacing,
		sizing: override.sizing ?? base.sizing,
		typography: override.typography ?? base.typography,
		radius: override.radius ?? base.radius,
		borderWidth: override.borderWidth ?? base.borderWidth,
		shadow: override.shadow ?? base.shadow,
		colors: override.colors ?? base.colors,
		colorThreshold: override.colorThreshold ?? base.colorThreshold,
	};
}
