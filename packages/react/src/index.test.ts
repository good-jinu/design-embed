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

	test("emits body children as-is (core unwraps the document before calling emit)", () => {
		const result = new ReactTarget().emit({
			nodes: [
				{
					kind: "element",
					tagName: "div",
					attributes: { "data-layer": "hero" },
					styles: {},
					children: [{ kind: "text", text: "Hello" }],
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

	test("emits a synthesized component with nested slot props", () => {
		const template: DesignNode = {
			kind: "element",
			tagName: "article",
			attributes: { class: "card" },
			styles: {},
			children: [
				{
					kind: "element",
					tagName: "img",
					attributes: { src: "a.jpg" },
					styles: {},
					attributeSlots: { src: "src" },
					children: [],
				},
				{
					kind: "element",
					tagName: "h3",
					attributes: {},
					styles: {},
					children: [{ kind: "slot", propName: "title" }],
				},
			],
		};
		const result = new ReactTarget().emit({
			nodes: [
				{
					kind: "component",
					component: "Card",
					importName: "Card",
					importPath: "./Card.view",
					props: {
						src: { kind: "literal", value: "a.jpg", attribute: "src" },
						title: { kind: "text", value: "Title A" },
					},
					sourceElement: template,
				},
			],
			config: { output: { viewName: "Page" } },
			diagnostics: [],
		});

		const card = result.files.find((file) =>
			file.path.endsWith("Card.view.tsx"),
		);
		assert.match(card?.contents ?? "", /interface CardProps {/);
		assert.match(card?.contents ?? "", /src\?: string;/);
		assert.match(card?.contents ?? "", /title\?: string;/);
		assert.match(card?.contents ?? "", /<img src=\{src\}><\/img>/);
		assert.match(card?.contents ?? "", /\{title\}/);

		const page = result.files.find((file) =>
			file.path.endsWith("Page.view.tsx"),
		);
		assert.match(page?.contents ?? "", /<Card src="a.jpg" title="Title A">/);
	});

	test("emits deterministic React visual regression tests", () => {
		const result = reactTestGenerator.generateTests({
			nodes: [],
			sourceNodes: [],
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
			snapshotPath: null,
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
		assert.match(
			result.files[1]?.contents ?? "",
			/const screenshotThreshold = 0\.2;/,
		);
		assert.match(
			result.files[1]?.contents ?? "",
			/await page.hover\(state.hover\);/,
		);
	});

	test("reports unsupported React test runners", () => {
		const result = reactTestGenerator.generateTests({
			nodes: [],
			sourceNodes: [],
			html: "<main></main>",
			config: {
				tests: {
					runner: "vitest" as "playwright",
				},
			},
			snapshotPath: null,
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
