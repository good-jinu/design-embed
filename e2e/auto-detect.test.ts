import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, test } from "node:test";
import { ReactTarget } from "@design-embed/react";
import { type DesignEmbedConfig, defineConfig, embed, fromFile } from "design-embed";

const fixtureDir = join(import.meta.dirname, "fixtures", "auto-detect");
const source = fromFile(
	new URL("./fixtures/auto-detect/auto-detect.html", import.meta.url),
);

function makeConfig(detect: DesignEmbedConfig["detect"]): DesignEmbedConfig {
	return defineConfig({
		sources: [{ source, output: { viewName: "Catalog" } }],
		output: { viewsDir: "./generated", target: new ReactTarget() },
		...(detect === undefined ? {} : { detect }),
	});
}

function find(
	files: { path: string; contents: string }[],
	suffix: string,
): string | undefined {
	return files.find((file) => file.path.endsWith(suffix))?.contents;
}

describe("component auto-detection (e2e)", () => {
	test("maps existing components and synthesizes repeated structures", async () => {
		const result = await embed({
			config: makeConfig({
				componentsDir: "./components",
				minOccurrences: 3,
				minSubtreeSize: 2,
			}),
			cwd: fixtureDir,
			dryRun: true,
		});

		assert.deepEqual(
			result.diagnostics.filter((d) => d.severity === "error"),
			[],
		);

		const view = find(result.files, "Catalog.view.tsx");
		assert.ok(view, "expected a Catalog.view.tsx file");

		// map-to-existing: the <button> is mapped to the hand-written Button and
		// imported from componentsDir — its implementation is never re-emitted.
		assert.match(view, /import \{ Button \} from "\.\.\/components\/Button";/);
		assert.match(view, /<Button>Get started<\/Button>/);
		assert.equal(
			find(result.files, "Button.view.tsx"),
			undefined,
			"existing components must not be re-generated",
		);

		// synthesize-new: the three repeated cards become one Card component, with
		// the leaves that vary across them (image, alt, title, body) as props.
		assert.match(view, /import \{ Card \} from "\.\/Card\.view";/);
		assert.match(
			view,
			/<Card alt="Alpha cover" src="\/a.jpg" text="First item" title="Alpha">/,
		);
		assert.match(
			view,
			/<Card alt="Gamma cover" src="\/c.jpg" text="Third item" title="Gamma">/,
		);

		const card = find(result.files, "Card.view.tsx");
		assert.ok(card, "expected a synthesized Card.view.tsx file");
		assert.match(card, /interface CardProps \{/);
		for (const prop of ["alt", "src", "text", "title"]) {
			assert.match(card, new RegExp(`${prop}\\?: string;`));
		}
		assert.match(card, /<img alt=\{alt\} src=\{src\}><\/img>/);
		assert.match(card, /\{title\}/);
		assert.match(card, /\{text\}/);
	});

	test("is off by default — without `detect` nothing is extracted", async () => {
		const result = await embed({
			config: makeConfig(undefined),
			cwd: fixtureDir,
			dryRun: true,
		});

		assert.deepEqual(
			result.diagnostics.filter((d) => d.severity === "error"),
			[],
		);
		const view = find(result.files, "Catalog.view.tsx");
		assert.ok(view);
		// Cards stay inline; the button stays a plain element; no components emitted.
		assert.match(view, /<article className="card">/);
		assert.doesNotMatch(view, /<Card\b/);
		assert.equal(find(result.files, "Card.view.tsx"), undefined);
		assert.equal(find(result.files, "Button.view.tsx"), undefined);
	});
});
