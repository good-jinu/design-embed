import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { embed } from "design-embed";
import simpleCardConfig from "./fixtures/simple-card/react.config.ts";
import webComponentsConfig from "./fixtures/web-components/react.config.ts";
import buttonConfig from "./fixtures/button/react.config.ts";
import cardWithImageConfig from "./fixtures/card-with-image/react.config.ts";
import tailwindCardConfig from "./fixtures/tailwind-card/react.config.ts";
import cssModuleCardConfig from "./fixtures/css-module-card/react.config.ts";

const root = import.meta.dirname;

function readExpectedDir(dir: string, prefix = ""): Map<string, string> {
	const files = new Map<string, string>();
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			for (const [k, v] of readExpectedDir(join(dir, entry.name), rel)) {
				files.set(k, v);
			}
		} else {
			files.set(rel, readFileSync(join(dir, entry.name), "utf-8"));
		}
	}
	return files;
}

const FIXTURES = [
	{ name: "simple-card", config: simpleCardConfig },
	{ name: "web-components", config: webComponentsConfig },
	{ name: "button", config: buttonConfig },
	{ name: "card-with-image", config: cardWithImageConfig },
	{ name: "tailwind-card", config: tailwindCardConfig },
	{ name: "css-module-card", config: cssModuleCardConfig, expectedDiagnosticCodes: ["CSS_SELECTOR_UNSUPPORTED"] },
];

describe("React target fixture pipeline", () => {
	for (const { name, config, expectedDiagnosticCodes = [] } of FIXTURES) {
		test(`${name}: output matches expected snapshots`, async () => {
			const result = await embed({ config, dryRun: true });

			assert.deepEqual(result.diagnostics.map((d) => d.code), expectedDiagnosticCodes);

			const expected = readExpectedDir(join(root, "fixtures", name, "expected-react"));
			const generatedPrefix = `fixtures/${name}/generated/`;

			assert.equal(result.files.length, expected.size);

			for (const file of result.files) {
				const rel = file.path.slice(generatedPrefix.length);
				assert.equal(file.contents, expected.get(rel), `snapshot mismatch: ${rel}`);
			}
		});
	}
});
