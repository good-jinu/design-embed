import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { embed, htmlEmitter, loadConfig } from "design-embed";

const fixtures = join(import.meta.dirname, "fixtures");

describe("config integration", () => {
	test("loads and validates the phase 1 fixture", async () => {
		const result = await loadConfig(join(fixtures, "phase1/simple-card.config.ts"));

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
		const html = readFileSync(join(fixtures, "phase1/simple-card.html"), "utf-8");
		const config = (await loadConfig(join(fixtures, "phase1/simple-card.config.ts")))
			.config;
		const result = await embed({ html, config, targetEmitter: htmlEmitter });

		assert.deepEqual(result.diagnostics, []);
		assert.equal(result.files[0]?.path, "e2e/fixtures/phase1/generated/debug.html");
		assert.equal(
			result.files[0]?.contents,
			readFileSync(join(fixtures, "phase1/expected.debug.html"), "utf-8"),
		);
	});
});
