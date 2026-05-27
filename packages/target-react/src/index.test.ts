import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { DesignNode, Diagnostic } from "design-embed";
import {
	emitReactView,
	reactEmitter,
	reactTarget,
	reactTestGenerator,
} from "./index.ts";

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

	test("emits a page assembly when assembliesDir is configured", () => {
		const diagnostics: Diagnostic[] = [];
		const result = reactEmitter.emit({
			nodes: [{ kind: "element", tagName: "main", children: [] }],
			config: {
				output: {
					viewName: "GeneratedView",
					viewsDir: "src/generated/views",
					assembliesDir: "src/generated/pages",
				},
			},
			diagnostics,
		});

		assert.deepEqual(diagnostics, []);
		assert.deepEqual(
			result.files.map((file) => file.path),
			[
				"src/generated/views/GeneratedView.view.tsx",
				"src/generated/pages/GeneratedViewPage.tsx",
			],
		);
		assert.equal(
			result.files[1]?.contents,
			`import { GeneratedView } from "../views/GeneratedView.view";

export default function GeneratedViewPage() {
\treturn <GeneratedView />;
}
`,
		);
	});

	test("emits deterministic React visual regression tests", () => {
		const diagnostics: Diagnostic[] = [];
		const result = reactTestGenerator.generateTests({
			html: '<section style="width: 120px">Hello</section>',
			config: {
				output: {
					target: reactTarget,
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
		assert.match(
			result.files[1]?.contents ?? "",
			/await page.hover\(state.hover\);/,
		);
	});

	test("reports unsupported React test runners", () => {
		const diagnostics: Diagnostic[] = [];
		const result = reactTestGenerator.generateTests({
			html: "<main></main>",
			config: {
				tests: {
					runner: "vitest" as "playwright",
				},
			},
			diagnostics,
		});

		assert.deepEqual(result.files, []);
		assert.deepEqual(diagnostics, [
			{
				code: "TEST_RUNNER_UNSUPPORTED",
				message: "Unsupported test runner: vitest",
				severity: "error",
			},
		]);
	});
});
