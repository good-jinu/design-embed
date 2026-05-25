import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { runCompileCommand } from "../packages/design-embed/src/commands/compile.ts";
import { runPluginCommand } from "../packages/design-embed/src/commands/plugin.ts";

describe("CLI workflow", () => {
	test("fetches source HTML with the default config and compiles it", async () => {
		const cwd = mkdtempSync(join(tmpdir(), "design-embed-cli-"));
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
\toutput: {
\t\tviewsDir: "generated/views",
\t},
};
`,
			"utf-8",
		);

		const fetchCode = await runPluginCommand(undefined, {
			"--cwd": cwd,
			"--out": "design.html",
		});
		assert.equal(fetchCode, 0);
		assert.equal(readFileSync(join(cwd, "design.html"), "utf-8"), "<main>Fetched</main>");

		const compileCode = await runCompileCommand({
			"--cwd": cwd,
			"--input": "design.html",
			"--quiet": true,
		});
		assert.equal(compileCode, 0);
		assert.equal(
			readFileSync(join(cwd, "generated/views/debug.html"), "utf-8"),
			"<main>\n\tFetched\n</main>\n",
		);
	});

	test("supports a non-default config path for source fetching", async () => {
		const cwd = mkdtempSync(join(tmpdir(), "design-embed-cli-"));
		writeFileSync(
			join(cwd, "custom.config.ts"),
			`export default {
\tplugins: [
\t\t{
\t\t\tname: "test-source",
\t\t\tasync run() {
\t\t\t\treturn { html: "<section>Custom</section>", diagnostics: [] };
\t\t\t},
\t\t},
\t],
};
`,
			"utf-8",
		);

		const code = await runPluginCommand(undefined, {
			"--cwd": cwd,
			"--config": "custom.config.ts",
			"--out": "design.html",
		});

		assert.equal(code, 0);
		assert.equal(
			readFileSync(join(cwd, "design.html"), "utf-8"),
			"<section>Custom</section>",
		);
		assert.equal(existsSync(join(cwd, "design-embed.config.ts")), false);
	});
});
