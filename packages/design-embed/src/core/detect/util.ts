import type { DesignNode } from "../nodes.ts";

/** Converts a kebab/snake/space separated string to PascalCase. */
export function toPascalCase(value: string): string {
	return value
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join("");
}

/** Converts a kebab/snake/space separated string to camelCase. */
export function toCamelCase(value: string): string {
	const pascal = toPascalCase(value);
	return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/** A prop identifier safe to use in generated TS/JS. */
export function toPropName(attribute: string): string {
	const camel = toCamelCase(attribute);
	return /^[a-zA-Z_$]/.test(camel) ? camel : `_${camel}`;
}

/** Class names declared on an element, in source order. */
export function classNamesOf(node: DesignNode): string[] {
	return (node.attributes?.class ?? "").split(/\s+/).filter(Boolean);
}

/** Concatenated descendant text of a node, whitespace-collapsed. */
export function collectText(node: DesignNode): string {
	if (node.kind === "text") {
		return node.text ?? "";
	}
	return (node.children ?? [])
		.map((child) => collectText(child))
		.filter(Boolean)
		.join(" ")
		.trim();
}

/** True when an element has no element children (only text, or empty). */
export function isTextOnly(node: DesignNode): boolean {
	return (
		node.kind === "element" &&
		(node.children ?? []).every((child) => child.kind === "text")
	);
}

/** Total number of nodes (elements + text) in a subtree, including the root. */
export function subtreeNodeCount(node: DesignNode): number {
	return 1 + (node.children ?? []).reduce((n, c) => n + subtreeNodeCount(c), 0);
}
