import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { DesignNode } from "design-embed";
import { emitReactView, ReactTarget, reactTestGenerator } from "./index.ts";

describe("React target", () => {
	test("emits a React view from design nodes", () => {
		const nodes: DesignNode[] = [
			{
				kind: "element",
				tagName: "section",
				attributes: { "data-testid": "hero" },
				styles: { width: "120px" },
				children: [{ kind: "text", text: "Hello" }],
			},
		];

		assert.equal(
			emitReactView(nodes, "HeroView"),
			`export function HeroView() {
\treturn (
\t\t<section data-testid="hero" style={{ width: "120px" }}>
\t\t\tHello
\t\t</section>
\t);
}
`,
		);
	});

	test("strips the document wrapper and emits only the body's children", () => {
		const result = new ReactTarget().emit({
			nodes: [
				{
					kind: "element",
					tagName: "html",
					attributes: { lang: "en" },
					styles: {},
					children: [
						{
							kind: "element",
							tagName: "head",
							attributes: {},
							styles: {},
							children: [
								{
									kind: "element",
									tagName: "title",
									attributes: {},
									styles: {},
									children: [{ kind: "text", text: "Figma" }],
								},
							],
						},
						{
							kind: "element",
							tagName: "body",
							attributes: {},
							styles: {},
							children: [
								{
									kind: "element",
									tagName: "div",
									attributes: { "data-layer": "hero" },
									styles: {},
									children: [{ kind: "text", text: "Hello" }],
								},
							],
						},
					],
				},
			],
			config: { output: { viewName: "WelcomeHero" } },
			diagnostics: [],
		});

		const view = result.files.find((file) =>
			file.path.endsWith("WelcomeHero.view.tsx"),
		);
		assert.equal(
			view?.contents,
			`export function WelcomeHero() {
\treturn (
\t\t<div data-layer="hero">
\t\t\tHello
\t\t</div>
\t);
}
`,
		);
	});

	test("emits deterministic React visual regression tests", () => {
		const result = reactTestGenerator.generateTests({
			html: '<section style="width: 120px">Hello</section>',
			config: {
				output: {
					target: new ReactTarget(),
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
		});

		assert.deepEqual(result.diagnostics, []);
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
		assert.match(
			result.files[1]?.contents ?? "",
			/await page.hover\(state.hover\);/,
		);
	});

	test("reports unsupported React test runners", () => {
		const result = reactTestGenerator.generateTests({
			html: "<main></main>",
			config: {
				tests: {
					runner: "vitest" as "playwright",
				},
			},
		});

		assert.deepEqual(result.files, []);
		assert.deepEqual(result.diagnostics, [
			{
				code: "TEST_RUNNER_UNSUPPORTED",
				message: "Unsupported test runner: vitest",
				severity: "error",
			},
		]);
	});
});
