import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { DesignNode } from "design-embed";
import { emitVanJsView, VanJsTarget, vanJsTestGenerator } from "./index.ts";

describe("VanJS target", () => {
	test("emits a VanJS view from design nodes", () => {
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
			emitVanJsView(nodes, "HeroView"),
			`import van from "vanjs-core";

const { section } = van.tags;

export function HeroView() {
	return (
		section({ "data-testid": "hero", style: "width: 120px;" },
			"Hello",
		)
	);
}
`,
		);
	});

	test("emits body children as-is (core unwraps the document before calling emit)", () => {
		const result = new VanJsTarget().emit({
			nodes: documentFixture(),
			config: { output: { viewName: "WelcomeHero" } },
			diagnostics: [],
		});

		const view = result.files.find((file) =>
			file.path.endsWith("WelcomeHero.view.ts"),
		);
		assert.ok(view, "expected a WelcomeHero.view.ts file");
		assert.match(view.contents, /"data-layer": "hero"/);
	});

	test("emits deterministic VanJS visual regression tests", () => {
		const result = vanJsTestGenerator.generateTests({
			nodes: [],
			sourceNodes: [],
			html: '<section style="width: 120px">Hello</section>',
			config: {
				output: {
					target: new VanJsTarget(),
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
				"tests/generated/GeneratedCard.visual.spec.ts",
				"src/generated/views/GeneratedCard.mount.entry.ts",
			],
		);
		assert.equal(
			result.files[0]?.contents,
			'<section style="width: 120px">Hello</section>\n',
		);
		assert.match(
			result.files[1]?.contents ?? "",
			/await page\.goto\("file:\/\/" \+ mountHtmlPath\);/,
		);
		assert.match(
			result.files[1]?.contents ?? "",
			/const screenshotThreshold = 0\.2;/,
		);
		assert.match(
			result.files[1]?.contents ?? "",
			/await page\.hover\(state\.hover\);/,
		);
		assert.equal(
			result.files[2]?.contents,
			'import van from "vanjs-core";\nimport { GeneratedCard } from "./GeneratedCard.view";\nvan.add(document.body, GeneratedCard());\n',
		);
	});

	test("reports unsupported VanJS test runners", () => {
		const result = vanJsTestGenerator.generateTests({
			nodes: [],
			sourceNodes: [],
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

/** Body children as delivered by the core after unwrapping the document. */
function documentFixture(): DesignNode[] {
	return [
		{
			kind: "element",
			tagName: "div",
			attributes: { "data-layer": "hero" },
			styles: {},
			children: [{ kind: "text", text: "Hello" }],
		},
	];
}
