import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { type DesignEmbedConfig, loadConfig, validateConfig } from "./index.ts";

describe("config", () => {
	test("reports invalid tokens", () => {
		const config = {
			tokens: {
				colors: {
					broken: "blue",
				},
			},
		} as DesignEmbedConfig;

		assert.deepEqual(
			validateConfig(config).map((diagnostic) => diagnostic.code),
			["TOKEN_COLOR_INVALID"],
		);
	});

	test("reports invalid target adapters", () => {
		const config = {
			output: {
				target: "react" as unknown,
			},
		} as DesignEmbedConfig;

		assert.deepEqual(
			validateConfig(config).map((diagnostic) => diagnostic.code),
			["TARGET_ADAPTER_INVALID"],
		);
	});

	test("validates a valid configuration object", () => {
		const config = {
			output: {
				styleMode: "tailwind" as const,
			},
			tokens: {
				spacing: {
					unit: "px" as const,
					threshold: 2,
					values: {
						"4": 16,
					},
				},
				radius: {
					lg: 8,
				},
				colors: {
					"blue-600": "#3B82F6",
				},
				colorThreshold: 4,
			},
			styleMappings: {
				spacing: {
					"padding:spacing.4": "p-4",
				},
			},
			tests: {
				runner: "playwright" as const,
				source: {
					html: "./design.html",
				},
				viewports: [{ name: "mobile", width: 390, height: 844 }],
				states: [{ name: "hover", hover: "button" }],
				assertions: {
					layoutTolerance: 1,
					selectors: [":scope *"],
				},
			},
		};

		assert.deepEqual(validateConfig(config), []);
	});

	test("validates test generation settings", () => {
		const config = {
			tests: {
				viewports: [{ width: 0, height: Number.NaN }],
				states: [{ name: "" }],
				assertions: {
					layoutTolerance: -1,
				},
			},
		} as DesignEmbedConfig;

		assert.deepEqual(
			validateConfig(config).map((diagnostic) => diagnostic.code),
			[
				"TEST_VIEWPORT_WIDTH_INVALID",
				"TEST_VIEWPORT_HEIGHT_INVALID",
				"TEST_STATE_NAME_INVALID",
				"TEST_LAYOUT_TOLERANCE_INVALID",
			],
		);
	});

	test("loads a configuration file asynchronously", async () => {
		const result = await loadConfig(
			"tests/fixtures/phase1/simple-card.config.ts",
		);
		assert.deepEqual(result.diagnostics, []);
		assert.equal(result.config?.output?.target, "html");
	});

	test("reports error for missing config file", async () => {
		const result = await loadConfig("non-existent.config.ts");
		assert.equal(result.diagnostics[0]?.code, "CONFIG_NOT_FOUND");
	});

	test("reports error for unsupported config format", async () => {
		const result = await loadConfig("tests/fixtures/phase1/simple-card.html");
		assert.equal(result.diagnostics[0]?.code, "CONFIG_UNSUPPORTED_FORMAT");
	});
});
