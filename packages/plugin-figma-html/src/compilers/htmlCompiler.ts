import type { FigmaCompiler, FigmaNode } from "../types.ts";
import { escapeHtml, getNodeStyles, toCssText } from "./compilerUtils.ts";

export const compileHtml: FigmaCompiler = (node) => [
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
${walkHtml(node, undefined, 2).trimEnd()}
  </body>
</html>
`,
	},
];

function walkHtml(node: FigmaNode, parent?: FigmaNode, depth = 0): string {
	if (!node || node.visible === false) return "";

	const indent = "  ".repeat(depth);
	const childIndent = "  ".repeat(depth + 1);
	const name = escapeHtml(node.name || "LayoutBox");
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
