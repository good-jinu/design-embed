import type { FigmaCompiler, FigmaNode } from "../types.ts";
import {
	escapeHtml,
	escapeJsString,
	getNodeStyles,
	toComponentName,
	toReactStyle,
} from "./compilerUtils.ts";

export const compileReact: FigmaCompiler = (node) => {
	const componentName = toComponentName(node.name);

	return [
		{
			path: "FigmaComponent.tsx",
			contents: `import React from 'react';

/**
 * Auto-generated UI component from Figma frame: "${escapeHtml(node.name)}"
 */
export const ${componentName}: React.FC = () => {
  return (
${walkReact(node).trimEnd()}
  );
};

export default ${componentName};
`,
		},
	];
};

function walkReact(node: FigmaNode, depth = 2): string {
	if (!node || node.visible === false) return "";

	const indent = "  ".repeat(depth);
	const childIndent = "  ".repeat(depth + 1);
	const name = escapeHtml(node.name || "LayoutBox");
	const styles = toReactStyle(getNodeStyles(node));

	if (node.type === "TEXT") {
		return `${indent}<span style={${styles}} data-layer={${escapeJsString(node.name || "LayoutBox")}}>
${childIndent}{${escapeJsString(node.characters)}}
${indent}</span>\n`;
	}

	const children =
		node.children
			?.map((child) => walkReactWithParent(child, node, depth + 1))
			.join("") || "";
	return `${indent}<div style={${styles}} data-layer="${name}">
${children}${indent}</div>\n`;
}

function walkReactWithParent(
	node: FigmaNode,
	parent: FigmaNode,
	depth: number,
): string {
	if (!node || node.visible === false) return "";

	const indent = "  ".repeat(depth);
	const childIndent = "  ".repeat(depth + 1);
	const name = escapeHtml(node.name || "LayoutBox");
	const styles = toReactStyle(getNodeStyles(node, parent));

	if (node.type === "TEXT") {
		return `${indent}<span style={${styles}} data-layer={${escapeJsString(node.name || "LayoutBox")}}>
${childIndent}{${escapeJsString(node.characters)}}
${indent}</span>\n`;
	}

	const children =
		node.children
			?.map((child) => walkReactWithParent(child, node, depth + 1))
			.join("") || "";
	return `${indent}<div style={${styles}} data-layer="${name}">
${children}${indent}</div>\n`;
}
