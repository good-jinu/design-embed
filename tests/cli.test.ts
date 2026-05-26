import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { runCompileCommand } from "../packages/design-embed/src/commands/compile.ts";
import { runPluginCommand } from "../packages/design-embed/src/commands/plugin.ts";

describe("CLI workflow", () => {
	test("fetches source HTML with the default config and compiles it", async () => {
		const cwd = mkdtempSync(join(tmpdir(), "design-embed-cli-"));
		copyFileSync(
			join(import.meta.dirname, "fixtures/cli/default.config.ts"),
			join(cwd, "design-embed.config.ts"),
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
		copyFileSync(
			join(import.meta.dirname, "fixtures/cli/custom.config.ts"),
			join(cwd, "custom.config.ts"),
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
