import type { FigmaNode, GeneratedFile } from "../types.ts";
import { escapeHtml, getNodeStyles, toCssText } from "./compilerUtils.ts";

export const compileHtml: (node: FigmaNode) => GeneratedFile[] = (node) => [
	{
		path: "index.html",
		contents: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(node.name || "Figma Export")}</title>
  </head>
  <body>
${compileHtmlFragment(node, 2)}
  </body>
</html>
`,
	},
];

/**
 * Compiles a Figma node tree into an HTML fragment without the surrounding
 * document scaffolding, for embedding into framework components.
 */
export function compileHtmlFragment(node: FigmaNode, depth = 0): string {
	return walkHtml(node, undefined, depth).trimEnd();
}

function walkHtml(node: FigmaNode, parent?: FigmaNode, depth = 0): string {
	if (!node || node.visible === false) return "";

	const indent = "  ".repeat(depth);
	const childIndent = "  ".repeat(depth + 1);
	const name = escapeHtml(node.name || "LayoutBox");

	const exportSource = node.exportLocalPath || node.exportUrl;
	if (exportSource) {
		const styles = getNodeStyles(node, parent);
		// The exported image already contains the subtree's fills and strokes.
		delete styles.backgroundColor;
		delete styles.border;
		const style = escapeHtml(toCssText(styles));
		return `${indent}<img src="${escapeHtml(exportSource)}" alt="${name}" style="${style}" data-layer="${name}" />\n`;
	}

	const style = escapeHtml(toCssText(getNodeStyles(node, parent)));

	if (node.type === "TEXT") {
		return `${indent}<span style="${style}" data-layer="${name}">
${childIndent}${escapeHtml(node.characters)}
${indent}</span>\n`;
	}

	const children =
		node.children?.map((child) => walkHtml(child, node, depth + 1)).join("") ||
		"";
	return `${indent}<div style="${style}" data-layer="${name}">
${children}${indent}</div>\n`;
}
