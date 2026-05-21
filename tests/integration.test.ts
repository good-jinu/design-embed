import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { loadConfig } from "../packages/config/src/index.ts";
import { htmlEmitter } from "../packages/target-html/src/index.ts";
import {
	reactEmitter,
	reactTestGenerator,
} from "../packages/target-react/src/index.ts";
import { type Diagnostic, embed } from "../packages/core/src/index.ts";

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

describe("compiler pipeline", () => {
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

	test("emits deterministic React view output for component mappings", async () => {
		const html = readFileSync("tests/fixtures/phase2/button.html", "utf-8");
		const config = (await loadConfig("tests/fixtures/phase2/button.config.ts"))
			.config;
		const result = await embed({ html, config, targetEmitter: reactEmitter });
		const secondResult = await embed({ html, config, targetEmitter: reactEmitter });

		assert.deepEqual(result.diagnostics, []);
		assert.equal(
			result.files[0]?.path,
			"tests/fixtures/phase2/generated/ButtonExample.view.tsx",
		);
		assert.equal(
			result.files[0]?.contents,
			readFileSync("tests/fixtures/phase2/expected/ButtonExample.view.tsx", "utf-8"),
		);
		assert.deepEqual(result.files, secondResult.files);
	});

	test("extracts attribute and children props into React components", async () => {
		const html = readFileSync("tests/fixtures/phase2/card-with-image.html", "utf-8");
		const config = (
			await loadConfig("tests/fixtures/phase2/card-with-image.config.ts")
		).config;
		const result = await embed({ html, config, targetEmitter: reactEmitter });

		assert.deepEqual(result.diagnostics, []);
		assert.equal(
			result.files[0]?.contents,
			readFileSync("tests/fixtures/phase2/expected/CardWithImage.view.tsx", "utf-8"),
		);
	});

	test("reports unsupported selectors before emission", async () => {
		const html = readFileSync("tests/fixtures/phase2/button.html", "utf-8");
		const config = (
			await loadConfig("tests/fixtures/phase2/unsupported-selector.config.ts")
		).config;
		const result = await embed({ html, config, targetEmitter: reactEmitter });

		assert.deepEqual(result.files, []);
		assert.deepEqual(result.diagnostics, [
			{
				code: "SELECTOR_UNSUPPORTED",
				message:
					"Component mapping 0 uses an unsupported selector: .card button",
				severity: "error",
			},
		]);
	});

	test("emits Tailwind classes from snapped style tokens", async () => {
		const html = readFileSync("tests/fixtures/phase3/tailwind-card.html", "utf-8");
		const config = (await loadConfig("tests/fixtures/phase3/tailwind-card.config.ts"))
			.config;
		const result = await embed({ html, config, targetEmitter: reactEmitter });
		const secondResult = await embed({ html, config, targetEmitter: reactEmitter });

		assert.deepEqual(result.diagnostics, []);
		assert.equal(
			result.files[0]?.contents,
			readFileSync("tests/fixtures/phase3/expected/TailwindCard.view.tsx", "utf-8"),
		);
		assert.deepEqual(result.files, secondResult.files);
	});

	test("emits stable CSS Modules from CSS selector styles", async () => {
		const html = readFileSync("tests/fixtures/phase3/css-module-card.html", "utf-8");
		const css = readFileSync("tests/fixtures/phase3/css-module-card.css", "utf-8");
		const config = (
			await loadConfig("tests/fixtures/phase3/css-module-card.config.ts")
		).config;
		const result = await embed({ html, css, config, targetEmitter: reactEmitter });

		assert.deepEqual(
			result.diagnostics.map((d) => d.code),
			["CSS_SELECTOR_UNSUPPORTED"],
		);
		assert.equal(
			result.files[0]?.contents,
			readFileSync("tests/fixtures/phase3/expected/CssModuleCard.view.tsx", "utf-8"),
		);
		assert.equal(
			result.files[1]?.contents,
			readFileSync("tests/fixtures/phase3/expected/CssModuleCard.module.css", "utf-8"),
		);
	});

	test("reports ambiguous token matches", async () => {
		const html = readFileSync("tests/fixtures/phase3/ambiguous-token.html", "utf-8");
		const config = (
			await loadConfig("tests/fixtures/phase3/ambiguous-token.config.ts")
		).config;
		const result = await embed({ html, config, targetEmitter: reactEmitter });

		assert.equal(result.diagnostics[0]?.code, "TOKEN_AMBIGUOUS_MATCH");
		assert.equal(result.diagnostics[0]?.severity, "error");
	});

	test("react-tailwind example output is current", async () => {
		const html = readFileSync("tests/examples/react-tailwind/design.html", "utf-8");
		const config = (
			await loadConfig("tests/examples/react-tailwind/design-embed.config.ts")
		).config;
		const result = await embed({ html, config, targetEmitter: reactEmitter });

		assert.deepEqual(result.diagnostics, []);
		assert.equal(
			result.files[0]?.contents,
			readFileSync(
				"tests/examples/react-tailwind/expected/src/generated/views/TailwindExample.view.tsx",
				"utf-8",
			),
		);
	});

	test("react-css-modules example output is current", async () => {
		const html = readFileSync("tests/examples/react-css-modules/design.html", "utf-8");
		const css = readFileSync("tests/examples/react-css-modules/design.css", "utf-8");
		const config = (
			await loadConfig("tests/examples/react-css-modules/design-embed.config.ts")
		).config;
		const result = await embed({ html, css, config, targetEmitter: reactEmitter });

		assert.deepEqual(result.diagnostics, []);
		assert.equal(
			result.files[0]?.contents,
			readFileSync(
				"tests/examples/react-css-modules/expected/src/generated/views/CssModulesExample.view.tsx",
				"utf-8",
			),
		);
		assert.equal(
			result.files[1]?.contents,
			readFileSync(
				"tests/examples/react-css-modules/expected/src/generated/views/CssModulesExample.module.css",
				"utf-8",
			),
		);
	});
});

describe("test generation", () => {
	test("emits deterministic React visual regression tests", () => {
		const diagnostics: Diagnostic[] = [];
		const result = reactTestGenerator.generateTests({
			html: '<section style="width: 120px">Hello</section>',
			config: {
				output: {
					target: "react",
					viewName: "GeneratedCard",
					viewsDir: "src/generated/views",
				},
				tests: {
					outputDir: "tests/generated",
					viewports: [{ name: "mobile", width: 390, height: 844 }],
					states: [{ name: "hovered", hover: "section" }],
					assertions: {
						screenshot: true,
						layout: true,
						layoutTolerance: 1,
						selectors: ["section"],
					},
				},
			},
			diagnostics,
		});

		assert.deepEqual(diagnostics, []);
		assert.deepEqual(
			result.files.map((file) => file.path),
			[
				"tests/generated/GeneratedCard.reference.html",
				"tests/generated/GeneratedCard.visual.spec.tsx",
			],
		);
		assert.equal(
			result.files[0]?.contents,
			'<section style="width: 120px">Hello</section>\n',
		);
		assert.match(
			result.files[1]?.contents ?? "",
			/import { GeneratedCard } from "..\/..\/src\/generated\/views\/GeneratedCard.view";/,
		);
		assert.match(result.files[1]?.contents ?? "", /const layoutTolerance = 1;/);
		assert.match(result.files[1]?.contents ?? "", /await page.hover\(state.hover\);/);
	});
});
