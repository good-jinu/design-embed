import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { runInitCommand } from "./init.ts";

describe("init command", () => {
	test("scaffolds starter config and design source", async () => {
		const cwd = mkdtempSync(join(tmpdir(), "design-embed-init-"));

		const code = await runInitCommand({ "--cwd": cwd, "--quiet": true });

		assert.equal(code, 0);
		assert.match(
			readFileSync(join(cwd, "design-embed.config.ts"), "utf-8"),
			/viewName: "WelcomeHero"/,
		);
		assert.match(
			readFileSync(join(cwd, "design.html"), "utf-8"),
			/Replace this file with HTML exported from your design source/,
		);
		assert.equal(existsSync(join(cwd, "playwright-ct.config.ts")), false);
	});

	test("does not overwrite existing files unless forced", async () => {
		const cwd = mkdtempSync(join(tmpdir(), "design-embed-init-"));
		const configPath = join(cwd, "design-embed.config.ts");
		writeFileSync(configPath, "custom config", "utf-8");

		await runInitCommand({ "--cwd": cwd, "--quiet": true });
		assert.equal(readFileSync(configPath, "utf-8"), "custom config");

		await runInitCommand({
			"--cwd": cwd,
			"--quiet": true,
			"--force": true,
			"--view-name": "ForcedView",
		});
		assert.match(readFileSync(configPath, "utf-8"), /viewName: "ForcedView"/);
	});
});
