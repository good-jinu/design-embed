import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { FigmaNode } from "../types.ts";
import { compileHtml, compileHtmlFragment } from "./index.ts";

const sampleNode: FigmaNode = {
	name: "Sample Frame",
	type: "FRAME",
	layoutMode: "VERTICAL",
	absoluteBoundingBox: {
		x: 0,
		y: 0,
		width: 100,
		height: 80,
	},
	children: [
		{
			name: "Title",
			type: "TEXT",
			characters: "Hello",
			absoluteBoundingBox: {
				x: 8,
				y: 8,
				width: 40,
				height: 20,
			},
		},
	],
};

describe("compilers", () => {
	test("compile a Figma node into generated files", () => {
		assert.match(compileHtml(sampleNode)[0]?.contents ?? "", /Hello/);
	});
});

describe("compileHtmlFragment", () => {
	test("emits markup without a document wrapper", () => {
		const fragment = compileHtmlFragment(sampleNode);

		assert.match(fragment, /^<div /);
		assert.match(fragment, /Hello/);
		assert.doesNotMatch(fragment, /<html|<head|<body/);
	});

	test("fills the cross axis with align-self, not flex-grow, in a column", () => {
		const node: FigmaNode = {
			name: "Column",
			type: "FRAME",
			layoutMode: "VERTICAL",
			absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 80 },
			children: [
				{
					name: "Title",
					type: "TEXT",
					characters: "Hi",
					layoutSizingHorizontal: "FILL",
					absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 20 },
				},
			],
		};

		const fragment = compileHtmlFragment(node);
		const span = fragment.split("\n").find((line) => line.includes("<span"));

		assert.ok(span, "expected a text span");
		assert.match(span, /align-self: stretch/);
		// Cross-axis fill must NOT grow the text on the column's main (vertical)
		// axis, and must not pin it to a fixed pixel width.
		assert.doesNotMatch(span, /flex-grow/);
		assert.doesNotMatch(span, /width: \d+px/);
	});

	test("fills the main axis with flex-grow in a row", () => {
		const node: FigmaNode = {
			name: "Row",
			type: "FRAME",
			layoutMode: "HORIZONTAL",
			absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 40 },
			children: [
				{
					name: "Cell",
					type: "FRAME",
					layoutSizingHorizontal: "FILL",
					absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 40 },
				},
			],
		};

		const fragment = compileHtmlFragment(node);
		assert.match(fragment, /flex-grow: 1/);
	});

	test("maps Figma text alignment to text-align", () => {
		const node: FigmaNode = {
			name: "Centered",
			type: "TEXT",
			characters: "Hi",
			style: { textAlignHorizontal: "CENTER" },
			absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 20 },
		};

		assert.match(compileHtmlFragment(node), /text-align: center/);
	});

	test("grows a non-clipping frame to cover overflowing content", () => {
		const node: FigmaNode = {
			name: "Page",
			type: "FRAME",
			layoutMode: "NONE",
			absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 100 },
			children: [
				{
					name: "Tall",
					type: "FRAME",
					absoluteBoundingBox: { x: 0, y: 200, width: 200, height: 150 },
				},
			],
		};

		// Content reaches y=350, so the frame must be 350px tall, not 100px,
		// otherwise its background would stop short of the overflow.
		assert.match(compileHtmlFragment(node), /height: 350px/);
	});

	test("renders exported subtrees as images instead of descending", () => {
		const node: FigmaNode = {
			name: "Icon",
			type: "GROUP",
			exportLocalPath: "assets/icon.svg",
			absoluteBoundingBox: { x: 0, y: 0, width: 24, height: 24 },
			fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }],
			children: [{ name: "Vector", type: "VECTOR" }],
		};

		const fragment = compileHtmlFragment(node);

		assert.match(fragment, /^<img src="assets\/icon\.svg"/);
		assert.doesNotMatch(fragment, /Vector/);
		assert.doesNotMatch(fragment, /background-color/);
	});
});
