import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

const cli = join(import.meta.dirname, "../packages/design-embed/src/cli.ts");

function runCli(args: string[]) {
	return spawnSync(process.execPath, ["--conditions=development", cli, ...args], {
		encoding: "utf-8",
	});
}

describe("CLI workflow", () => {
	test("runs plugin and compiles with the default config", () => {
		const cwd = mkdtempSync(join(tmpdir(), "design-embed-cli-"));
		copyFileSync(
			join(import.meta.dirname, "fixtures/cli/default.config.ts"),
			join(cwd, "design-embed.config.ts"),
		);

		const result = runCli(["--cwd", cwd, "--quiet"]);
		assert.equal(result.status, 0, result.stderr);
		assert.equal(
			readFileSync(join(cwd, "generated/views/index.html"), "utf-8"),
			"<main>\n\tFetched\n</main>\n",
		);
	});

	test("supports a non-default config path", () => {
		const cwd = mkdtempSync(join(tmpdir(), "design-embed-cli-"));
		copyFileSync(
			join(import.meta.dirname, "fixtures/cli/custom.config.ts"),
			join(cwd, "custom.config.ts"),
		);

		const result = runCli(["--cwd", cwd, "--config", "custom.config.ts", "--quiet"]);
		assert.equal(result.status, 0, result.stderr);
		assert.equal(existsSync(join(cwd, "design-embed.config.ts")), false);
		assert.equal(
			readFileSync(join(cwd, "generated/views/index.html"), "utf-8"),
			"<section>\n\tCustom\n</section>\n",
		);
	});
});
