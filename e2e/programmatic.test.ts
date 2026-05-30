import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { embed } from "design-embed";
import phase1Config from "./fixtures/phase1/simple-card.config.ts";
import webComponentsConfig from "./fixtures/web-components/product-list.config.ts";

const fixtures = join(import.meta.dirname, "fixtures");

describe("programmatic compiler pipeline", () => {
	test("emits web component substitutions for the product list fixture", async () => {
		const result = await embed({ config: webComponentsConfig, dryRun: true });

		assert.deepEqual(result.diagnostics, []);
		assert.equal(result.files[0]?.path, "fixtures/web-components/generated/ProductList.html");
		assert.equal(
			result.files[0]?.contents,
			readFileSync(join(fixtures, "web-components/expected.html"), "utf-8"),
		);
	});

	test("generates a visual regression spec for the web components fixture", async () => {
		const result = await embed({ config: webComponentsConfig, generateTests: true, dryRun: true });

		assert.deepEqual(result.diagnostics, []);
		assert.deepEqual(result.files.map((f) => f.path), [
			"fixtures/web-components/generated/ProductList.html",
			"fixtures/web-components/generated/tests/ProductList.reference.html",
			"fixtures/web-components/generated/tests/ProductList.spec.ts",
		]);
		assert.equal(result.files[1]?.contents, result.html);
		assert.match(result.files[2]?.contents ?? "", /ProductList\.reference\.html/);
		assert.match(result.files[2]?.contents ?? "", /page\.setContent\(referenceHtml\)/);
		assert.match(result.files[2]?.contents ?? "", /page\.goto\("file:\/\/" \+ outputHtmlPath\)/);
		assert.match(result.files[2]?.contents ?? "", /ProductList matches source/);
	});

	test("emits deterministic debug HTML for the fixture", async () => {
		const result = await embed({ config: phase1Config, dryRun: true });

		assert.deepEqual(result.diagnostics, []);
		assert.equal(result.files[0]?.path, "fixtures/phase1/generated/index.html");
		assert.equal(
			result.files[0]?.contents,
			readFileSync(join(fixtures, "phase1/expected.html"), "utf-8"),
		);
	});
});
