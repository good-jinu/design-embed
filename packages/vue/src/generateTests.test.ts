import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { vueTestGenerator } from "./index.ts";

const baseInput = {
	nodes: [],
	sourceNodes: [],
	html: "<div class='hero'>Hello</div>",
	css: undefined,
	config: {
		tests: {
			runner: "playwright" as const,
			assertions: {
				screenshot: true,
				screenshotThreshold: 0.2,
				screenshotMaxDiffPixels: 500,
			},
		},
	},
};

describe("Vue generateTests — snapshotPath integration", () => {
	test("generated spec calls toHaveScreenshot with baseline name when snapshotPath is set", () => {
		const result = vueTestGenerator.generateTests({
			...baseInput,
			snapshotPath: "/path/to/__snapshots__/Hero.png",
		});

		const spec = result.files.find((f) => f.path.endsWith(".visual.spec.ts"));
		assert.ok(spec, "expected a .visual.spec.ts file");
		assert.ok(
			spec.contents.includes(`toHaveScreenshot({ name: "Hero.png"`),
			`expected toHaveScreenshot({ name: "Hero.png" ... }) in:\n${spec.contents}`,
		);
	});

	test("generated spec does not include a baseline name when snapshotPath is null", () => {
		const result = vueTestGenerator.generateTests({
			...baseInput,
			snapshotPath: null,
		});

		const spec = result.files.find((f) => f.path.endsWith(".visual.spec.ts"));
		assert.ok(spec, "expected a .visual.spec.ts file");
		assert.ok(
			spec.contents.includes("toHaveScreenshot()"),
			`expected toHaveScreenshot() in:\n${spec.contents}`,
		);
		assert.ok(
			!spec.contents.includes("toHaveScreenshot({ name:"),
			`unexpected toHaveScreenshot({ name: ... }) in:\n${spec.contents}`,
		);
	});

	test("generated spec passes screenshotThreshold and screenshotMaxDiffPixels to toHaveScreenshot", () => {
		const result = vueTestGenerator.generateTests({
			...baseInput,
			config: {
				...baseInput.config,
				tests: {
					...baseInput.config.tests,
					assertions: {
						screenshotThreshold: 0.05,
						screenshotMaxDiffPixels: 100,
					},
				},
			},
			snapshotPath: "/snaps/Hero.png",
		});

		const spec = result.files.find((f) => f.path.endsWith(".visual.spec.ts"));
		const content = spec?.contents ?? "";
		assert.ok(
			content.includes("threshold: 0.05"),
			`expected threshold: 0.05 in:\n${content}`,
		);
		assert.ok(
			content.includes("maxDiffPixels: 100"),
			`expected maxDiffPixels: 100 in:\n${content}`,
		);
	});

	test("generated spec includes beforeAll block when snapshot mode is headless", () => {
		const result = vueTestGenerator.generateTests({
			...baseInput,
			config: {
				...baseInput.config,
				snapshot: {
					mode: "headless" as const,
					dir: "/snaps",
					format: "png" as const,
					scale: 1,
				},
			},
			snapshotPath: null,
		});

		const spec = result.files.find((f) => f.path.endsWith(".visual.spec.ts"));
		const content = spec?.contents ?? "";
		assert.ok(
			content.includes("beforeAll"),
			`expected beforeAll in:\n${content}`,
		);
		assert.ok(
			content.includes("UPDATE_SNAPSHOTS"),
			`expected UPDATE_SNAPSHOTS in:\n${content}`,
		);
		assert.ok(
			content.includes("setContent"),
			`expected setContent in:\n${content}`,
		);
	});

	test("headless beforeAll embeds the source HTML", () => {
		const result = vueTestGenerator.generateTests({
			...baseInput,
			html: "<div class='banner'>Ad</div>",
			config: {
				...baseInput.config,
				snapshot: {
					mode: "headless" as const,
					dir: "/snaps",
					format: "png" as const,
					scale: 1,
				},
			},
			snapshotPath: null,
		});

		const spec = result.files.find((f) => f.path.endsWith(".visual.spec.ts"));
		const content = spec?.contents ?? "";
		assert.ok(
			content.includes("banner"),
			`expected source HTML (banner) to appear in beforeAll:\n${content}`,
		);
	});
});
