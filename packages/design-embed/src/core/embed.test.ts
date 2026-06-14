import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { embed } from "./index.ts";
import type {
	DesignEmbedConfig,
	TargetEmitInput,
	TargetEmitter,
	TargetTestGenerateInput,
	TargetTestGenerator,
} from "./types.ts";

const makePlugin = (html: string, name = "test") => ({
	name,
	run: async () => ({ html, css: undefined, diagnostics: [] }),
});

const errorPlugin = {
	name: "error-plugin",
	run: async () => ({
		html: "",
		diagnostics: [{ code: "X", message: "boom", severity: "error" as const }],
	}),
};

describe("embed — multi-source loop", () => {
	test("two sources both produce output files", async () => {
		const result = await embed({
			config: {
				sources: [
					{
						plugin: makePlugin("<div>A</div>"),
						output: { viewsDir: "./out/a" },
					},
					{
						plugin: makePlugin("<div>B</div>"),
						output: { viewsDir: "./out/b" },
					},
				],
			},
			dryRun: true,
		});
		assert.ok(result.files.length >= 2);
		assert.equal(
			result.diagnostics.filter((d) => d.severity === "error").length,
			0,
		);
	});

	test("error in one source does not prevent other sources from running", async () => {
		const result = await embed({
			config: {
				sources: [
					{ plugin: errorPlugin },
					{
						plugin: makePlugin("<div>OK</div>"),
						output: { viewsDir: "./out" },
					},
				],
			},
			dryRun: true,
		});
		assert.ok(result.files.length >= 1);
		assert.ok(result.diagnostics.some((d) => d.severity === "error"));
	});

	test("empty sources array returns PLUGIN_REQUIRED error", async () => {
		const result = await embed({ config: { sources: [] }, dryRun: true });
		assert.ok(
			result.diagnostics.some(
				(d) => d.code === "PLUGIN_REQUIRED" && d.severity === "error",
			),
		);
		assert.equal(result.files.length, 0);
	});

	test("old source field produces the same output as sources array", async () => {
		const plugin = makePlugin("<div>legacy</div>");

		const oldResult = await embed({
			config: {
				source: plugin,
				output: { viewsDir: "./out" },
			} as DesignEmbedConfig,
			dryRun: true,
		});
		const newResult = await embed({
			config: { sources: [{ plugin, output: { viewsDir: "./out" } }] },
			dryRun: true,
		});

		assert.equal(oldResult.files.length, newResult.files.length);
		assert.equal(
			oldResult.diagnostics.filter((d) => d.severity === "error").length,
			0,
		);
	});

	test("generateTests is called with snapshotPath: null when no snapshot configured", async () => {
		let capturedInput: TargetTestGenerateInput | undefined;
		const mockTarget: TargetEmitter & TargetTestGenerator = {
			emit: (_: TargetEmitInput) => ({ files: [] }),
			generateTests: (input: TargetTestGenerateInput) => {
				capturedInput = input;
				return { files: [], diagnostics: [] };
			},
		};

		await embed({
			config: {
				sources: [
					{
						plugin: makePlugin("<div/>"),
						output: { target: mockTarget },
					},
				],
			},
			generateTests: true,
			dryRun: true,
		});

		assert.equal(capturedInput?.snapshotPath, null);
	});
});
