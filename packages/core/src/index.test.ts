import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	applyComponentMappings,
	checkGeneratedFiles,
	embed,
	matchesSelector,
	parseHtml,
	parseSelector,
	type TargetEmitter,
	toJsonDiagnostics,
} from "./index.ts";

const htmlEmitter: TargetEmitter = {
	emit({ nodes }) {
		return {
			files: [
				{
					path: "debug.html",
					contents: nodes
						.map((node) => {
							const attributes = Object.entries(node.attributes ?? {})
								.sort(([left], [right]) => left.localeCompare(right))
								.map(([name, value]) => `${name}="${value}"`)
								.join(" ");
							const openTag = attributes
								? `<${node.tagName} ${attributes}>`
								: `<${node.tagName}>`;
							return `${openTag}\n\t${node.children?.[0]?.text ?? ""}\n</${node.tagName}>\n`;
						})
						.join(""),
				},
			],
		};
	},
};

describe("core", () => {
	test("parses HTML into a stable AST shape", () => {
		const ast = parseHtml(
			`<div class="x" style="padding: 4px;"><span>Hello</span></div>`,
		);

		assert.deepEqual(ast, [
			{
				kind: "element",
				tagName: "div",
				attributes: {
					class: "x",
					style: "padding: 4px;",
				},
				styles: {
					padding: "4px",
				},
				children: [
					{
						kind: "element",
						tagName: "span",
						attributes: {},
						styles: {},
						children: [
							{
								kind: "text",
								text: "Hello",
								source: { offset: 43, line: 1, column: 44 },
							},
						],
						source: { offset: 37, line: 1, column: 38 },
					},
				],
				source: { offset: 0, line: 1, column: 1 },
			},
		]);
	});

	test("debug emitter is deterministic across repeated runs", () => {
		const html = `<section><p>One</p><p>Two</p></section>`;
		const first = htmlEmitter.emit({
			nodes: parseHtml(html),
			diagnostics: [],
		});
		const second = htmlEmitter.emit({
			nodes: parseHtml(html),
			diagnostics: [],
		});

		assert.deepEqual(first, second);
	});

	test("matches the phase 2 selector subset", () => {
		const [node] = parseHtml(
			`<button id="start" class="primary wide" data-role="primary">Go</button>`,
		);
		const selector = parseSelector("button.primary[data-role='primary']");

		assert.notEqual(node, undefined);
		assert.deepEqual(selector, {
			tagName: "button",
			classes: ["primary"],
			attributes: { "data-role": "primary" },
		});
		if (!node || !selector) {
			throw new Error("Expected test node and selector.");
		}
		assert.equal(matchesSelector(node, selector), true);
		assert.equal(parseSelector(".card button"), undefined);
	});

	test("substitutes mapped components and extracts text props", () => {
		const ast = parseHtml(`<button data-role="primary">Continue</button>`);
		const transformed = applyComponentMappings(ast, [
			{
				selector: "button[data-role='primary']",
				component: "@/components/ui/Button",
				importName: "Button",
				props: {
					variant: "primary",
					children: "$text",
				},
			},
		]);

		assert.deepEqual(
			{
				kind: transformed[0]?.kind,
				component: transformed[0]?.component,
				importPath: transformed[0]?.importPath,
				props: transformed[0]?.props,
			},
			{
				kind: "component",
				component: "Button",
				importPath: "@/components/ui/Button",
				props: {
					variant: { kind: "literal", value: "primary" },
					children: { kind: "text", value: "Continue" },
				},
			},
		);
	});

	test("check mode reports missing and stale files", () => {
		const result = checkGeneratedFiles({
			cwd: process.cwd(),
			files: [
				{ path: "one.txt", contents: "expected" },
				{ path: "two.txt", contents: "expected" },
			],
			readFile(path) {
				return path.endsWith("one.txt") ? "stale" : undefined;
			},
		});

		assert.equal(result.ok, false);
		assert.deepEqual(
			result.diagnostics.map((d) => d.code),
			["CHECK_FILE_STALE", "CHECK_FILE_MISSING"],
		);
	});

	test("emits stable JSON diagnostics", () => {
		assert.deepEqual(
			toJsonDiagnostics([
				{
					code: "EXAMPLE",
					message: "Bearer secret-token",
					severity: "error",
					file: "design.html",
					source: { offset: 0, line: 2, column: 4 },
				},
			]),
			[
				{
					code: "EXAMPLE",
					severity: "error",
					message: "Bearer [redacted]",
					file: "design.html",
					line: 2,
					column: 4,
				},
			],
		);
	});
});
