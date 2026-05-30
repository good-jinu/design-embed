import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { embed } from "design-embed";
import buttonConfig from "./fixtures/phase2/button.config.ts";
import cardWithImageConfig from "./fixtures/phase2/card-with-image.config.ts";
import unsupportedSelectorConfig from "./fixtures/phase2/unsupported-selector.config.ts";
import tailwindCardConfig from "./fixtures/phase3/tailwind-card.config.ts";
import cssModuleCardConfig from "./fixtures/phase3/css-module-card.config.ts";
import ambiguousTokenConfig from "./fixtures/phase3/ambiguous-token.config.ts";
import reactTailwindConfig from "./examples/react-tailwind/design-embed.config.ts";
import reactCssModulesConfig from "./examples/react-css-modules/design-embed.config.ts";

const fixtures = join(import.meta.dirname, "fixtures");
const examples = join(import.meta.dirname, "examples");

describe("React target fixture pipeline", () => {
	test("emits deterministic React view output for component mappings", async () => {
		const result = await embed({ config: buttonConfig, dryRun: true });
		const secondResult = await embed({ config: buttonConfig, dryRun: true });

		assert.deepEqual(result.diagnostics, []);
		assert.equal(
			result.files[0]?.path,
			"fixtures/phase2/generated/ButtonExample.view.tsx",
		);
		assert.equal(
			result.files[0]?.contents,
			readFileSync(join(fixtures, "phase2/expected/ButtonExample.view.tsx"), "utf-8"),
		);
		assert.deepEqual(result.files, secondResult.files);
	});

	test("extracts attribute and children props into React components", async () => {
		const result = await embed({ config: cardWithImageConfig, dryRun: true });

		assert.deepEqual(result.diagnostics, []);
		assert.deepEqual(
			result.files.map((f) => f.path),
			[
				"fixtures/phase2/generated/CardWithImage.view.tsx",
				"fixtures/phase2/generated/ProductLink.view.tsx",
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
		const result = await embed({ config: unsupportedSelectorConfig, dryRun: true });

		assert.deepEqual(result.files, []);
		assert.deepEqual(result.diagnostics, [
			{
				code: "SELECTOR_UNSUPPORTED",
				message: "Component mapping 0 uses an unsupported selector: .card button",
				severity: "error",
			},
		]);
	});

	test("emits Tailwind classes from snapped style tokens", async () => {
		const result = await embed({ config: tailwindCardConfig, dryRun: true });
		const secondResult = await embed({ config: tailwindCardConfig, dryRun: true });

		assert.deepEqual(result.diagnostics, []);
		assert.equal(
			result.files[0]?.contents,
			readFileSync(join(fixtures, "phase3/expected/TailwindCard.view.tsx"), "utf-8"),
		);
		assert.deepEqual(result.files, secondResult.files);
	});

	test("emits stable CSS Modules from CSS selector styles", async () => {
		const result = await embed({ config: cssModuleCardConfig, dryRun: true });

		assert.deepEqual(
			result.diagnostics.map((d) => d.code),
			["CSS_SELECTOR_UNSUPPORTED"],
		);
		assert.equal(
			result.files[0]?.contents,
			readFileSync(join(fixtures, "phase3/expected/CssModuleCard.view.tsx"), "utf-8"),
		);
		assert.equal(
			result.files[1]?.contents,
			readFileSync(join(fixtures, "phase3/expected/CssModuleCard.module.css"), "utf-8"),
		);
	});

	test("reports ambiguous token matches", async () => {
		const result = await embed({ config: ambiguousTokenConfig, dryRun: true });

		assert.equal(result.diagnostics[0]?.code, "TOKEN_AMBIGUOUS_MATCH");
		assert.equal(result.diagnostics[0]?.severity, "error");
	});

	test("react-tailwind example output is current", async () => {
		const result = await embed({ config: reactTailwindConfig, dryRun: true });

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
		const result = await embed({ config: reactCssModulesConfig, dryRun: true });

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
