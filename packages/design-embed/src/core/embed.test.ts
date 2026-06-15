import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { embed } from "./index.ts";
import type {
	TargetEmitInput,
	TargetEmitter,
	TargetTestGenerateInput,
	TargetTestGenerator,
} from "./types.ts";

const makePlugin = (html: string) => ({
	run: async () => ({ html, css: undefined, diagnostics: [] }),
});

const errorPlugin = {
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
						source: makePlugin("<div>A</div>"),
						output: { viewsDir: "./out/a" },
					},
					{
						source: makePlugin("<div>B</div>"),
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
					{ source: errorPlugin },
					{
						source: makePlugin("<div>OK</div>"),
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

	test("snapshot capture failure adds a warning diagnostic but still writes output", async () => {
		global.fetch = async () => {
			throw new Error("network error");
		};

		const result = await embed({
			config: {
				sources: [
					{
						source: {
							name: "figma",
							run: async () => ({
								html: "<div/>",
								diagnostics: [],
								meta: { fileId: "x", nodeId: "1:1", viewName: "Hero" },
							}),
						},
						snapshot: {
							mode: "figma-api" as const,
							dir: "/tmp/snaps",
							format: "png" as const,
							scale: 1,
						},
					},
				],
			},
			figmaToken: "tok",
			dryRun: true,
		});

		assert.ok(
			result.diagnostics.some(
				(d) => d.code === "SNAPSHOT_FAILED" && d.severity === "warning",
			),
		);
		assert.ok(result.files.length > 0);
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
						source: makePlugin("<div/>"),
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
