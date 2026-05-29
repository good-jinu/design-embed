import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { embed, htmlEmitter, htmlTestGenerator, loadConfig } from "design-embed";

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
	test("emits web component substitutions for the product list fixture", async () => {
		const html = readFileSync(join(fixtures, "web-components/product-list.html"), "utf-8");
		const config = (await loadConfig(join(fixtures, "web-components/product-list.config.ts")))
			.config;
		const result = await embed({ html, config, targetEmitter: htmlEmitter });

		assert.deepEqual(result.diagnostics, []);
		assert.equal(result.files[0]?.path, "e2e/fixtures/web-components/generated/ProductList.html");
		assert.equal(
			result.files[0]?.contents,
			readFileSync(join(fixtures, "web-components/expected.html"), "utf-8"),
		);
	});

	test("generates a visual regression spec comparing input and output for the web components fixture", async () => {
		const html = readFileSync(join(fixtures, "web-components/product-list.html"), "utf-8");
		const { config } = await loadConfig(join(fixtures, "web-components/product-list.config.ts"));
		assert.ok(config);
		const diagnostics: never[] = [];
		const result = htmlTestGenerator.generateTests({ html, config, diagnostics });

		assert.deepEqual(diagnostics, []);
		assert.deepEqual(result.files.map((f) => f.path), [
			"tests/generated/design-embed/ProductList.reference.html",
			"tests/generated/design-embed/ProductList.spec.ts",
		]);
		assert.equal(result.files[0]?.contents, html);
		assert.match(result.files[1]?.contents ?? "", /ProductList\.reference\.html/);
		assert.match(result.files[1]?.contents ?? "", /page\.setContent\(referenceHtml\)/);
		assert.match(result.files[1]?.contents ?? "", /page\.goto\("file:\/\/" \+ outputHtmlPath\)/);
		assert.match(result.files[1]?.contents ?? "", /ProductList matches source/);
	});

	test("emits deterministic debug HTML for the fixture", async () => {
		const html = readFileSync(join(fixtures, "phase1/simple-card.html"), "utf-8");
		const config = (await loadConfig(join(fixtures, "phase1/simple-card.config.ts")))
			.config;
		const result = await embed({ html, config, targetEmitter: htmlEmitter });

		assert.deepEqual(result.diagnostics, []);
		assert.equal(result.files[0]?.path, "e2e/fixtures/phase1/generated/index.html");
		assert.equal(
			result.files[0]?.contents,
			readFileSync(join(fixtures, "phase1/expected.html"), "utf-8"),
		);
	});
});
