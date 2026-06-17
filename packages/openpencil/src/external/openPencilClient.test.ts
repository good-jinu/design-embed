import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { extractParamsFromPath } from "./openPencilClient.ts";

describe("extractParamsFromPath", () => {
	test("returns the bare path when there is no node suffix", () => {
		assert.deepEqual(extractParamsFromPath("/path/to/design.fig"), {
			fileKey: "/path/to/design.fig",
			nodeId: null,
		});
	});

	test("splits a path#nodeId reference", () => {
		assert.deepEqual(extractParamsFromPath("/path/to/design.fig#1:23"), {
			fileKey: "/path/to/design.fig",
			nodeId: "1:23",
		});
	});

	test("handles relative .pen paths with a node id", () => {
		assert.deepEqual(extractParamsFromPath("design.pen#5:10"), {
			fileKey: "design.pen",
			nodeId: "5:10",
		});
	});

	test("trims surrounding whitespace and treats an empty suffix as null", () => {
		assert.deepEqual(extractParamsFromPath("  design.pen#  "), {
			fileKey: "design.pen",
			nodeId: null,
		});
	});
});
