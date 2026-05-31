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
`
		);
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
`
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
