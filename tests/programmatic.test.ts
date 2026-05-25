import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { loadConfig } from "../packages/config/src/index.ts";
import { embed } from "../packages/core/src/index.ts";
import { htmlEmitter } from "../packages/design-embed/src/targets/html.ts";

describe("config integration", () => {
	test("loads and validates the phase 1 fixture", async () => {
		const result = await loadConfig("tests/fixtures/phase1/simple-card.config.ts");

		assert.deepEqual(result.diagnostics, []);
		assert.equal(result.config?.output?.target, "html");
		assert.equal(
			result.config?.components?.[0]?.component,
			"@/components/ui/Button",
		);
	});
});

describe("programmatic compiler pipeline", () => {
	test("emits deterministic debug HTML for the fixture", async () => {
		const html = readFileSync("tests/fixtures/phase1/simple-card.html", "utf-8");
		const config = (await loadConfig("tests/fixtures/phase1/simple-card.config.ts"))
			.config;
		const result = await embed({ html, config, targetEmitter: htmlEmitter });

		assert.deepEqual(result.diagnostics, []);
		assert.equal(result.files[0]?.path, "tests/fixtures/phase1/generated/debug.html");
		assert.equal(
			result.files[0]?.contents,
			readFileSync("tests/fixtures/phase1/expected.debug.html", "utf-8"),
		);
	});
});
