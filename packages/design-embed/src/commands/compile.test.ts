import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { runCompileCommand } from "./compile.ts";

describe("compile command", () => {
	test("generates built-in HTML from a positional input without a target adapter", async () => {
		const cwd = mkdtempSync(join(tmpdir(), "design-embed-compile-"));
		writeFileSync(
			join(cwd, "target.html"),
			'<section style="width: 120px">Hello</section>',
			"utf-8",
		);

		const code = await runCompileCommand({
			"--cwd": cwd,
			"--": "target.html",
			"--quiet": true,
		});

		assert.equal(code, 0);
		assert.equal(existsSync(join(cwd, "src/components")), false);
		assert.equal(existsSync(join(cwd, "src/pages")), false);
		assert.equal(existsSync(join(cwd, "tests")), false);
		assert.equal(
			readFileSync(join(cwd, "src/generated/views/index.html"), "utf-8"),
			'<section style="width: 120px">\n\tHello\n</section>\n',
		);
	});

	test("uses a configured target adapter and skips its tests with --no-test", async () => {
		const cwd = mkdtempSync(join(tmpdir(), "design-embed-compile-"));
		writeFileSync(join(cwd, "target.html"), "<main>No tests</main>", "utf-8");
		writeFileSync(
			join(cwd, "design-embed.config.mjs"),
			`export default {
	output: {
		target: {
			emit() {
				return {
					files: [{ path: "src/components/Adapter.view.tsx", contents: "component\\n" }],
				};
			},
			generateTests() {
				return {
					files: [{ path: "tests/Adapter.spec.tsx", contents: "test\\n" }],
				};
			},
		},
	},
};
`,
			"utf-8",
		);

		const code = await runCompileCommand({
			"--cwd": cwd,
			"--": "target.html",
			"--config": "design-embed.config.mjs",
			"--no-test": true,
			"--quiet": true,
		});

		assert.equal(code, 0);
		assert.equal(
			readFileSync(join(cwd, "src/components/Adapter.view.tsx"), "utf-8"),
			"component\n",
		);
		assert.equal(existsSync(join(cwd, "tests")), false);
	});

	test("uses design-embed.config.ts by default when it exists", async () => {
		const cwd = mkdtempSync(join(tmpdir(), "design-embed-compile-"));
		writeFileSync(
			join(cwd, "target.html"),
			"<main>Default config</main>",
			"utf-8",
		);
		writeFileSync(
			join(cwd, "design-embed.config.ts"),
			`export default {
\toutput: {
\t\tviewsDir: "custom/generated",
\t},
};
`,
			"utf-8",
		);

		const code = await runCompileCommand({
			"--cwd": cwd,
			"--input": "target.html",
			"--quiet": true,
		});

		assert.equal(code, 0);
		assert.equal(
			readFileSync(join(cwd, "custom/generated/index.html"), "utf-8"),
			"<main>\n\tDefault config\n</main>\n",
		);
	});
});
