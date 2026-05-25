import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { runPluginCommand } from "./plugin.ts";

describe("source plugin command", () => {
	test("uses design-embed.config.ts by default", async () => {
		const cwd = mkdtempSync(join(tmpdir(), "design-embed-plugin-"));
		writeFileSync(
			join(cwd, "design-embed.config.ts"),
			`export default {
\tplugins: [
\t\t{
\t\t\tname: "test-source",
\t\t\tasync run() {
\t\t\t\treturn { html: "<main>Fetched</main>", diagnostics: [] };
\t\t\t},
\t\t},
\t],
};
`,
			"utf-8",
		);

		const code = await runPluginCommand(undefined, {
			"--cwd": cwd,
			"--out": "design.html",
		});

		assert.equal(code, 0);
		assert.equal(
			readFileSync(join(cwd, "design.html"), "utf-8"),
			"<main>Fetched</main>",
		);
	});
});
