import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { DesignNode } from "design-embed";
import { emitVueView, VueTarget, vueTestGenerator } from "./index.ts";

describe("Vue target", () => {
	test("emits a Vue view from design nodes (Composition API)", () => {
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
			emitVueView(nodes, "HeroView", { api: "composition" }),
			`
<template>
\t<section data-testid="hero" :style="{ 'width': '120px' }">
\t\tHello
\t</section>
</template>
`,
		);
	});

	test("strips the document wrapper and emits only the body's children", () => {
		const result = new VueTarget().emit({
			nodes: documentFixture(),
			config: { output: { viewName: "WelcomeHero" } },
			diagnostics: [],
		});

		const view = result.files.find((file) =>
			file.path.endsWith("WelcomeHero.vue"),
		);
		assert.ok(view, "expected a WelcomeHero.vue file");
		assert.match(view.contents, /data-layer="hero"/);
		assert.doesNotMatch(view.contents, /<html|<head|<body/);
	});

	test("emits a Vue view from design nodes (Options API)", () => {
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
			emitVueView(nodes, "HeroView", { api: "options" }),
			`<script lang="ts">
import { defineComponent } from "vue";
export default defineComponent({
\tcomponents: {  }
});
</script>

<template>
\t<section data-testid="hero" :style="{ 'width': '120px' }">
\t\tHello
\t</section>
</template>
`,
		);
	});

	test("emits mapped text children through the children slot", () => {
		const nodes: DesignNode[] = [
			{
				kind: "element",
				tagName: "section",
				attributes: {},
				styles: {},
				children: [
					{
						kind: "component",
						component: "Button",
						importName: "Button",
						importPath: "./Button.vue",
						props: {
							variant: { kind: "literal", value: "primary" },
							children: { kind: "text", value: "Continue" },
						},
						children: [],
					},
				],
			},
		];

		assert.equal(
			emitVueView(nodes, "HeroView", { api: "composition" }),
			`<script setup lang="ts">
import Button from "./Button.vue";
</script>

<template>
\t<section>
\t\t<Button variant="primary">
\t\t\t<template #children>Continue</template>
\t\t</Button>
\t</section>
</template>
`,
		);
	});

	test("emits deterministic Vue visual regression tests", () => {
		const result = vueTestGenerator.generateTests({
			html: '<section style="width: 120px">Hello</section>',
			config: {
				output: {
					target: new VueTarget(),
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
			],
		);
		assert.equal(
			result.files[0]?.contents,
			'<section style="width: 120px">Hello</section>\n',
		);
		assert.match(
			result.files[1]?.contents ?? "",
			/import GeneratedCard from "..\/..\/src\/generated\/views\/GeneratedCard.vue";/,
		);
		assert.match(result.files[1]?.contents ?? "", /const layoutTolerance = 1;/);
		assert.match(
			result.files[1]?.contents ?? "",
			/await page.hover\(state.hover\);/,
		);
	});
});

/** A full HTML document (as Figma exports), wrapping a single body element. */
function documentFixture(): DesignNode[] {
	return [
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
	];
}
