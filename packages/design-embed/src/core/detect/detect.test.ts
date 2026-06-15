import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { embed, parseHtml } from "../index.ts";
import type { DesignNode } from "../nodes.ts";
import type { TargetEmitter } from "../types.ts";
import { fingerprint } from "./fingerprint.ts";
import { matchExisting } from "./matchExisting.ts";
import { scanComponents } from "./scan.ts";
import { synthesizeComponents } from "./synthesize.ts";

const SYNTH = { minOccurrences: 3, minSubtreeSize: 2 };

describe("fingerprint", () => {
	test("ignores text content and matches identical structure", () => {
		const [a] = parseHtml(`<a class="chip" href="/a">One</a>`);
		const [b] = parseHtml(`<a class="chip" href="/b">Two</a>`);
		assert.ok(a && b);
		assert.equal(fingerprint(a), fingerprint(b));
	});

	test("differs by tag and class skeleton", () => {
		const [a] = parseHtml(`<a class="chip">x</a>`);
		const [b] = parseHtml(`<button class="chip">x</button>`);
		const [c] = parseHtml(`<a class="tag">x</a>`);
		assert.ok(a && b && c);
		assert.notEqual(fingerprint(a), fingerprint(b));
		assert.notEqual(fingerprint(a), fingerprint(c));
	});
});

describe("synthesizeComponents", () => {
	const chips = (n: number) =>
		parseHtml(
			`<div>${Array.from(
				{ length: n },
				(_, i) => `<a class="chip" href="/${i}">Item ${i}</a>`,
			).join("")}</div>`,
		);

	test("extracts repeated text-only elements with text + attr props", () => {
		const out = synthesizeComponents(chips(3), SYNTH);
		const div = out[0];
		const first = div?.children?.[0];
		assert.equal(first?.kind, "component");
		assert.equal(first?.component, "Chip");
		assert.equal(first?.importPath, "./Chip.view");
		assert.deepEqual(first?.props?.href, {
			kind: "literal",
			value: "/0",
			attribute: "href",
		});
		assert.deepEqual(first?.props?.children, {
			kind: "text",
			value: "Item 0",
		});
		// Each occurrence carries its own prop values.
		assert.equal(div?.children?.[2]?.props?.href?.value, "/2");
	});

	test("does not extract below minOccurrences", () => {
		const out = synthesizeComponents(chips(2), SYNTH);
		assert.equal(out[0]?.children?.[0]?.kind, "element");
	});

	test("deduplicates identical repeated subtrees with no props", () => {
		const cards = parseHtml(
			`<div>${'<section class="card"><h3>T</h3></section>'.repeat(3)}</div>`,
		);
		const out = synthesizeComponents(cards, SYNTH);
		const card = out[0]?.children?.[0];
		assert.equal(card?.kind, "component");
		assert.equal(card?.component, "Card");
		assert.deepEqual(card?.props, {});
	});

	test("skips groups whose inline styles differ", () => {
		const nodes = parseHtml(
			`<div><a class="chip" style="color:red">a</a><a class="chip" style="color:blue">b</a><a class="chip" style="color:green">c</a></div>`,
		);
		const out = synthesizeComponents(nodes, SYNTH);
		assert.equal(out[0]?.children?.[0]?.kind, "element");
	});

	test("Stage B: parameterizes nested leaves of repeated subtrees", () => {
		const cards = parseHtml(
			`<div>${["a", "b", "c"]
				.map(
					(k) =>
						`<article class="card"><img src="${k}.jpg"><h3>Title ${k}</h3><p>Body ${k}</p></article>`,
				)
				.join("")}</div>`,
		);
		const out = synthesizeComponents(cards, SYNTH);
		const card = out[0]?.children?.[0];
		assert.equal(card?.kind, "component");
		assert.equal(card?.component, "Card");
		assert.equal(card?.props?.src?.value, "a.jpg");
		assert.equal(card?.props?.title?.value, "Title a");
		assert.equal(card?.props?.text?.value, "Body a");
		// The shared template carries slots / attributeSlots, not literal content.
		const template = card?.sourceElement;
		const img = template?.children?.find((n) => n.tagName === "img");
		assert.equal(img?.attributeSlots?.src, "src");
		const h3 = template?.children?.find((n) => n.tagName === "h3");
		assert.equal(h3?.children?.[0]?.kind, "slot");
		assert.equal(h3?.children?.[0]?.propName, "title");
		// Each occurrence keeps its own values.
		assert.equal(out[0]?.children?.[2]?.props?.title?.value, "Title c");
	});

	test("Stage B: bails when inline styles differ across instances", () => {
		const cards = parseHtml(
			`<div>${["red", "blue", "green"]
				.map(
					(c) =>
						`<article class="card"><h3 style="color:${c}">T</h3></article>`,
				)
				.join("")}</div>`,
		);
		const out = synthesizeComponents(cards, SYNTH);
		assert.equal(out[0]?.children?.[0]?.kind, "element");
	});

	test("assigns deterministic unique names across groups", () => {
		const nodes = parseHtml(
			`<div>${'<a class="x">a</a>'.repeat(3)}${'<button class="x">b</button>'.repeat(3)}</div>`,
		);
		const out = synthesizeComponents(nodes, SYNTH);
		const names = (out[0]?.children ?? [])
			.filter((n) => n.kind === "component")
			.map((n) => n.component);
		assert.deepEqual([...new Set(names)], ["X", "X2"]);
	});
});

describe("scanComponents + matchExisting", () => {
	const withTempDir = (fn: (dir: string) => void) => {
		const dir = mkdtempSync(join(tmpdir(), "detect-"));
		try {
			fn(dir);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	};

	test("scans PascalCase files and extracts prop names", () => {
		withTempDir((dir) => {
			writeFileSync(
				join(dir, "Button.tsx"),
				`interface ButtonProps { variant?: string; children?: ReactNode }\nexport function Button() {}`,
			);
			writeFileSync(join(dir, "helpers.ts"), "export const x = 1;");
			const scanned = scanComponents(dir);
			assert.equal(scanned.length, 1);
			assert.equal(scanned[0]?.name, "Button");
			assert.deepEqual(scanned[0]?.props.sort(), ["children", "variant"]);
		});
	});

	test("warns and returns nothing when the dir is missing", () => {
		const diagnostics: { code: string }[] = [];
		const scanned = scanComponents("/no/such/dir", diagnostics as never);
		assert.equal(scanned.length, 0);
		assert.equal(diagnostics[0]?.code, "DETECT_COMPONENTS_DIR_MISSING");
	});

	test("maps elements to existing components as external nodes", () => {
		withTempDir((dir) => {
			writeFileSync(
				join(dir, "Button.tsx"),
				`interface ButtonProps { variant?: string; children?: ReactNode }`,
			);
			const scanned = scanComponents(dir);
			const nodes = parseHtml(
				`<button class="cta" variant="primary">Click</button>`,
			);
			const out = matchExisting(nodes, scanned, join(dir, "views"));
			const node = out[0];
			assert.equal(node?.kind, "component");
			assert.equal(node?.external, true);
			assert.equal(node?.importName, "Button");
			assert.equal(node?.importPath, "../Button");
			assert.deepEqual(node?.props?.variant, {
				kind: "literal",
				value: "primary",
				attribute: "variant",
			});
			assert.deepEqual(node?.props?.children, {
				kind: "text",
				value: "Click",
			});
		});
	});
});

describe("embed() with detect enabled", () => {
	test("feeds detected nodes to the target", async () => {
		let captured: DesignNode[] = [];
		const stub: TargetEmitter = {
			emit({ nodes }) {
				captured = nodes;
				return { files: [], diagnostics: [] };
			},
		};

		await embed({
			dryRun: true,
			config: {
				detect: true,
				output: { target: stub, viewsDir: "/out" },
				sources: [
					{
						source: {
							name: "inline",
							run: async () => ({
								html: `<div>${'<a class="chip" href="/x">x</a>'.repeat(3)}</div>`,
								diagnostics: [],
							}),
						},
					},
				],
			},
		});

		const chip = captured[0]?.children?.[0];
		assert.equal(chip?.kind, "component");
		assert.equal(chip?.component, "Chip");
	});
});
