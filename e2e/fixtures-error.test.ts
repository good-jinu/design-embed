import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { embed } from "design-embed";

const root = import.meta.dirname;
const errorFixtures = join(root, "fixtures-error");

describe("error fixture diagnostics", () => {
	for (const name of readdirSync(errorFixtures)) {
		const dir = join(errorFixtures, name);

		if (existsSync(join(dir, "expected-diagnostics.json"))) {
			test(`${name}/default: diagnostics match`, async () => {
				const { default: config } = await import(join(dir, "default.config.ts"));
				const result = await embed({ config });
				const expected = JSON.parse(readFileSync(join(dir, "expected-diagnostics.json"), "utf-8"));
				assert.deepEqual(result.diagnostics, expected);
			});
		}

		if (existsSync(join(dir, "expected-react-diagnostics.json"))) {
			test(`${name}/react: diagnostics match`, async () => {
				const { default: config } = await import(join(dir, "react.config.ts"));
				const result = await embed({ config, dryRun: true });
				const expected = JSON.parse(readFileSync(join(dir, "expected-react-diagnostics.json"), "utf-8"));
				assert.deepEqual(result.diagnostics, expected);
			});
		}
	}
});
