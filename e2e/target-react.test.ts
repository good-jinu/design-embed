import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { embed, loadConfig } from "design-embed";
import { reactEmitter } from "@design-embed/target-react";

const fixtures = join(import.meta.dirname, "fixtures");
const examples = join(import.meta.dirname, "examples");

describe("React target fixture pipeline", () => {
	test("emits deterministic React view output for component mappings", async () => {
		const html = readFileSync(join(fixtures, "phase2/button.html"), "utf-8");
		const config = (await loadConfig(join(fixtures, "phase2/button.config.ts")))
			.config;
		const result = await embed({ html, config, targetEmitter: reactEmitter });
		const secondResult = await embed({ html, config, targetEmitter: reactEmitter });

		assert.deepEqual(result.diagnostics, []);
		assert.equal(
			result.files[0]?.path,
			"e2e/fixtures/phase2/generated/ButtonExample.view.tsx",
		);
		assert.equal(
			result.files[0]?.contents,
			readFileSync(
				join(fixtures, "phase2/expected/ButtonExample.view.tsx"),
				"utf-8",
			),
		);
		assert.deepEqual(result.files, secondResult.files);
	});

	test("extracts attribute and children props into React components", async () => {
		const html = readFileSync(join(fixtures, "phase2/card-with-image.html"), "utf-8");
		const config = (
			await loadConfig(join(fixtures, "phase2/card-with-image.config.ts"))
		).config;
		const result = await embed({ html, config, targetEmitter: reactEmitter });

		assert.deepEqual(result.diagnostics, []);
		assert.deepEqual(
			result.files.map((f) => f.path),
			[
				"e2e/fixtures/phase2/generated/CardWithImage.view.tsx",
				"e2e/fixtures/phase2/generated/ProductLink.view.tsx",
			],
		);
		assert.equal(
			result.files[0]?.contents,
			readFileSync(join(fixtures, "phase2/expected/CardWithImage.view.tsx"), "utf-8"),
		);
		assert.equal(
			result.files[1]?.contents,
			readFileSync(join(fixtures, "phase2/expected/ProductLink.view.tsx"), "utf-8"),
		);
	});

	test("reports unsupported selectors before emission", async () => {
		const html = readFileSync(join(fixtures, "phase2/button.html"), "utf-8");
		const config = (
			await loadConfig(join(fixtures, "phase2/unsupported-selector.config.ts"))
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
		const html = readFileSync(join(fixtures, "phase3/tailwind-card.html"), "utf-8");
		const config = (await loadConfig(join(fixtures, "phase3/tailwind-card.config.ts")))
			.config;
		const result = await embed({ html, config, targetEmitter: reactEmitter });
		const secondResult = await embed({ html, config, targetEmitter: reactEmitter });

		assert.deepEqual(result.diagnostics, []);
		assert.equal(
			result.files[0]?.contents,
			readFileSync(
				join(fixtures, "phase3/expected/TailwindCard.view.tsx"),
				"utf-8",
			),
		);
		assert.deepEqual(result.files, secondResult.files);
	});

	test("emits stable CSS Modules from CSS selector styles", async () => {
		const html = readFileSync(join(fixtures, "phase3/css-module-card.html"), "utf-8");
		const css = readFileSync(join(fixtures, "phase3/css-module-card.css"), "utf-8");
		const config = (
			await loadConfig(join(fixtures, "phase3/css-module-card.config.ts"))
		).config;
		const result = await embed({ html, css, config, targetEmitter: reactEmitter });

		assert.deepEqual(
			result.diagnostics.map((d) => d.code),
			["CSS_SELECTOR_UNSUPPORTED"],
		);
		assert.equal(
			result.files[0]?.contents,
			readFileSync(
				join(fixtures, "phase3/expected/CssModuleCard.view.tsx"),
				"utf-8",
			),
		);
		assert.equal(
			result.files[1]?.contents,
			readFileSync(
				join(fixtures, "phase3/expected/CssModuleCard.module.css"),
				"utf-8",
			),
		);
	});

	test("reports ambiguous token matches", async () => {
		const html = readFileSync(join(fixtures, "phase3/ambiguous-token.html"), "utf-8");
		const config = (
			await loadConfig(join(fixtures, "phase3/ambiguous-token.config.ts"))
		).config;
		const result = await embed({ html, config, targetEmitter: reactEmitter });

		assert.equal(result.diagnostics[0]?.code, "TOKEN_AMBIGUOUS_MATCH");
		assert.equal(result.diagnostics[0]?.severity, "error");
	});

	test("react-tailwind example output is current", async () => {
		const html = readFileSync(join(examples, "react-tailwind/design.html"), "utf-8");
		const config = (
			await loadConfig(join(examples, "react-tailwind/design-embed.config.ts"))
		).config;
		const result = await embed({ html, config, targetEmitter: reactEmitter });

		assert.deepEqual(result.diagnostics, []);
		assert.equal(
			result.files[0]?.contents,
			readFileSync(
				join(examples, "react-tailwind/expected/src/generated/views/TailwindExample.view.tsx"),
				"utf-8",
			),
		);
	});

	test("react-css-modules example output is current", async () => {
		const html = readFileSync(join(examples, "react-css-modules/design.html"), "utf-8");
		const css = readFileSync(join(examples, "react-css-modules/design.css"), "utf-8");
		const config = (
			await loadConfig(join(examples, "react-css-modules/design-embed.config.ts"))
		).config;
		const result = await embed({ html, css, config, targetEmitter: reactEmitter });

		assert.deepEqual(result.diagnostics, []);
		assert.equal(
			result.files[0]?.contents,
			readFileSync(
				join(examples, "react-css-modules/expected/src/generated/views/CssModulesExample.view.tsx"),
				"utf-8",
			),
		);
		assert.equal(
			result.files[1]?.contents,
			readFileSync(
				join(examples, "react-css-modules/expected/src/generated/views/CssModulesExample.module.css"),
				"utf-8",
			),
		);
	});
});
