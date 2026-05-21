import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { FigmaNode } from "../types.ts";
import {
	compileHtml,
	compileReact,
	compileVanjs,
	getCompiler,
} from "./index.ts";

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

describe("compiler registry", () => {
	test("returns compiler functions without external dependencies", () => {
		assert.equal(getCompiler("html"), compileHtml);
		assert.equal(getCompiler("react"), compileReact);
		assert.equal(getCompiler("vanjs"), compileVanjs);
	});
});

describe("compilers", () => {
	test("compile a Figma node into generated files", () => {
		assert.match(compileHtml(sampleNode)[0]?.contents ?? "", /Hello/);
		assert.match(compileReact(sampleNode)[0]?.contents ?? "", /SampleFrame/);
		assert.deepEqual(
			compileVanjs(sampleNode).map((file) => file.path),
			["index.html", "main.js"],
		);
	});
});
