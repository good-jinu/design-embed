import type { FigmaCompiler, FigmaNode } from "../types.ts";
import {
	escapeHtml,
	escapeJsString,
	getNodeStyles,
	toCssText,
} from "./compilerUtils.ts";

export const compileVanjs: FigmaCompiler = (node) => [
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
    <div id="app"></div>
    <script type="module" src="./main.js"></script>
  </body>
</html>
`,
	},
	{
		path: "main.js",
		contents: `import van from 'https://cdn.jsdelivr.net/npm/vanjs-core@1.5.5/src/van.min.js';

const { div, span } = van.tags;

const App = () => (
${walkVanjs(node, undefined, 1).trimEnd()}
);

van.add(document.getElementById('app'), App());
`,
	},
];

function walkVanjs(node: FigmaNode, parent?: FigmaNode, depth = 0): string {
	if (!node || node.visible === false) return "null";

	const indent = "  ".repeat(depth);
	const childIndent = "  ".repeat(depth + 1);
	const tag = node.type === "TEXT" ? "span" : "div";
	const props = `{
${childIndent}style: ${escapeJsString(toCssText(getNodeStyles(node, parent)))},
${childIndent}"data-layer": ${escapeJsString(node.name || "LayoutBox")}
${indent}}`;

	if (node.type === "TEXT") {
		return `${indent}${tag}(${props}, ${escapeJsString(node.characters)})\n`;
	}

	const children = (node.children || [])
		.map((child) => walkVanjs(child, node, depth + 1))
		.filter((value) => value.trim() !== "null")
		.join(",");

	if (!children) {
		return `${indent}${tag}(${props})\n`;
	}

	return `${indent}${tag}(${props},
${children}${indent})\n`;
}
