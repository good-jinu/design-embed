import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { TargetTestGenerateInput } from "../core/types.ts";
import { resolveConfig } from "./index.ts";

const minimalPlugin = {
	run: async () => ({ html: "<div/>", diagnostics: [] }),
};

describe("resolveConfig — defaults", () => {
	test("applies default viewsDir", () => {
		const r = resolveConfig({ sources: [{ source: minimalPlugin }] }, "/cwd");
		assert.equal(r.output.viewsDir, "/cwd/src/views");
	});

	test("applies default target", () => {
		const r = resolveConfig({ sources: [{ source: minimalPlugin }] }, "/cwd");
		assert.equal(r.output.target, "html");
	});

	test("applies default test runner", () => {
		const r = resolveConfig({ sources: [{ source: minimalPlugin }] }, "/cwd");
		assert.equal(r.sources[0]?.tests.runner, "playwright");
	});

	test("applies default screenshotThreshold", () => {
		const r = resolveConfig({ sources: [{ source: minimalPlugin }] }, "/cwd");
		assert.equal(r.sources[0]?.tests.assertions?.screenshotThreshold, 0.2);
	});

	test("applies default screenshotMaxDiffPixels", () => {
		const r = resolveConfig({ sources: [{ source: minimalPlugin }] }, "/cwd");
		assert.equal(r.sources[0]?.tests.assertions?.screenshotMaxDiffPixels, 500);
	});

	test("applies default snapshot dir alongside viewsDir", () => {
		const r = resolveConfig({ sources: [{ source: minimalPlugin }] }, "/cwd");
		assert.equal(r.sources[0]?.snapshot.dir, "/cwd/src/views/__snapshots__");
	});

	test("applies default snapshot format png", () => {
		const r = resolveConfig({ sources: [{ source: minimalPlugin }] }, "/cwd");
		assert.equal(r.sources[0]?.snapshot.format, "png");
	});

	test("applies default snapshot scale 1", () => {
		const r = resolveConfig({ sources: [{ source: minimalPlugin }] }, "/cwd");
		assert.equal(r.sources[0]?.snapshot.scale, 1);
	});
});

describe("resolveConfig — per-source overrides", () => {
	test("source output.viewsDir overrides global", () => {
		const r = resolveConfig(
			{
				output: { viewsDir: "./global" },
				sources: [{ source: minimalPlugin, output: { viewsDir: "./local" } }],
			},
			"/cwd",
		);
		assert.equal(r.sources[0]?.output.viewsDir, "/cwd/local");
	});

	test("source components are appended after global components", () => {
		const globalComp = { selector: ".a", component: "A" };
		const srcComp = { selector: ".b", component: "B" };
		const r = resolveConfig(
			{
				components: [globalComp],
				sources: [{ source: minimalPlugin, components: [srcComp] }],
			},
			"/cwd",
		);
		assert.deepEqual(r.sources[0]?.components, [globalComp, srcComp]);
	});
});

describe("TargetTestGenerateInput — type-level snapshotPath check", () => {
	test("snapshotPath field exists on the type", () => {
		// Type-level check: this must compile without error.
		const _check: TargetTestGenerateInput = {
			nodes: [],
			sourceNodes: [],
			html: "",
			config: {},
			snapshotPath: null,
		};
		assert.equal(_check.snapshotPath, null);
	});
});
