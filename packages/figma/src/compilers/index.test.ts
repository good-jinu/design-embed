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
