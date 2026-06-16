import type { DesignNode } from "design-embed";
import { matchesSelector, parseSelector } from "./styles.ts";

export const VOID_ELEMENTS = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
]);

export function collectImports(
	nodes: DesignNode[],
): Array<{ importName: string; importPath: string }> {
	const imports = new Map<string, { importName: string; importPath: string }>();
	function visit(node: DesignNode) {
		if (node.kind === "component" && node.importName && node.importPath) {
			imports.set(`${node.importPath}:${node.importName}`, {
				importName: node.importName,
				importPath: node.importPath,
			});
		}
		for (const child of node.children ?? []) visit(child);
		for (const prop of Object.values(node.props ?? {})) {
			if (prop.kind === "children")
				for (const child of prop.value) visit(child);
		}
	}
	for (const node of nodes) visit(node);
	return [...imports.values()].sort((a, b) =>
		a.importPath.localeCompare(b.importPath),
	);
}

export function collectSlotProps(node: DesignNode): Set<string> {
	const names = new Set<string>();
	function visit(current: DesignNode): void {
		if (current.kind === "slot" && current.propName) {
			names.add(current.propName);
		}
		for (const propName of Object.values(current.attributeSlots ?? {})) {
			names.add(propName);
		}
		for (const child of current.children ?? []) visit(child);
	}
	visit(node);
	return names;
}

/**
 * Walks a mapped AST and returns the first component node seen for each
 * component name, so the test generator can mount components with the same
 * props the design supplies.
 */
export function collectComponentNodes(
	nodes: DesignNode[],
): Map<string, DesignNode> {
	const map = new Map<string, DesignNode>();
	function visit(list: DesignNode[]): void {
		for (const node of list) {
			if (node.kind === "component") {
				const name = node.component ?? node.importName;
				if (name && !map.has(name)) {
					map.set(name, node);
				}
				const childrenProp = node.props?.children;
				visit(
					childrenProp?.kind === "children"
						? childrenProp.value
						: (node.children ?? []),
				);
			} else if (node.kind === "element") {
				visit(node.children ?? []);
			}
		}
	}
	visit(nodes);
	return map;
}

export function findNodeBySelector(
	nodes: DesignNode[],
	selector: string,
): DesignNode | undefined {
	const parsedSelector = parseSelector(selector);
	if (!parsedSelector) return undefined;
	const ps = parsedSelector;
	function search(list: DesignNode[]): DesignNode | undefined {
		for (const node of list) {
			if (matchesSelector(node, ps)) return node;
			const found = search(node.children ?? []);
			if (found) return found;
		}
		return undefined;
	}
	return search(nodes);
}

export function serializeNodeToHtml(node: DesignNode): string {
	if (node.kind === "text") return node.text ?? "";
	if (node.kind !== "element") return "";
	const tagName = node.tagName ?? "div";
	const attrs = Object.entries(node.attributes ?? {})
		.map(([name, value]) =>
			value === "" ? name : `${name}="${value.replace(/"/g, "&quot;")}"`,
		)
		.join(" ");
	const openTag = attrs ? `<${tagName} ${attrs}>` : `<${tagName}>`;
	if (VOID_ELEMENTS.has(tagName)) return openTag;
	const children = (node.children ?? []).map(serializeNodeToHtml).join("");
	return `${openTag}${children}</${tagName}>`;
}
