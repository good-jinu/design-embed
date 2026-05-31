import assert from "node:assert/strict";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { describe, test } from "node:test";
import { embed } from "design-embed";
import simpleCardConfig from "./fixtures/simple-card/vue.config.ts";

const root = import.meta.dirname;
const UPDATE_SNAPSHOTS = process.env.UPDATE_SNAPSHOTS === "1";

function readExpectedDir(dir: string, prefix = ""): Map<string, string> {
	const files = new Map<string, string>();
	if (!existsSync(dir)) return files;
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
	{ name: "simple-card", config: simpleCardConfig, generateTests: true },
];

describe("Vue target fixture pipeline", () => {
	for (const { name, config, expectedDiagnosticCodes = [], generateTests } of FIXTURES) {
		test(`${name}: output matches expected snapshots`, async () => {
			const result = await embed({ config, generateTests });

			assert.deepEqual(result.diagnostics.map((d) => d.code), expectedDiagnosticCodes);

			const expectedDir = join(root, "fixtures", name, "expected-vue");
			const generatedPrefix = `fixtures/${name}/generated/`;

			if (UPDATE_SNAPSHOTS) {
				for (const file of result.files) {
					const rel = file.path.slice(file.path.indexOf('generated/') + 10);
					const dest = join(expectedDir, rel);
					mkdirSync(dirname(dest), { recursive: true });
					writeFileSync(dest, file.contents);
				}
				return;
			}

			const expected = readExpectedDir(expectedDir);
			assert.equal(result.files.length, expected.size, `Expected ${expected.size} files, but got ${result.files.length}`);

			for (const file of result.files) {
				const rel = file.path.slice(file.path.indexOf('generated/') + 10);
				assert.equal(file.contents, expected.get(rel), `snapshot mismatch: ${rel}`);
			}
		});
	}
});
