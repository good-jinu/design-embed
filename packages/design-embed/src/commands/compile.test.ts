import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { runCompileCommand } from "./compile.ts";

describe("compile command", () => {
	test("generates built-in HTML from a source plugin without a target adapter", async () => {
		const cwd = mkdtempSync(join(tmpdir(), "design-embed-compile-"));
		writeFileSync(
			join(cwd, "design-embed.config.ts"),
			`export default {
	source: {
		name: "test-source",
		async run() {
			return { html: '<section style="width: 120px">Hello</section>', diagnostics: [] };
		},
	},
};
`,
			"utf-8",
		);

		const code = await runCompileCommand({
			"--cwd": cwd,
			"--quiet": true,
		});

		assert.equal(code, 0);
		assert.equal(existsSync(join(cwd, "src/components")), false);
		assert.equal(existsSync(join(cwd, "src/pages")), false);
		assert.equal(existsSync(join(cwd, "src/generated/views/tests")), true);
		assert.equal(
			readFileSync(join(cwd, "src/generated/views/index.html"), "utf-8"),
			'<section style="width: 120px">\n\tHello\n</section>\n',
		);
	});

	test("uses a configured target adapter and skips its tests with --no-test", async () => {
		const cwd = mkdtempSync(join(tmpdir(), "design-embed-compile-"));
		writeFileSync(
			join(cwd, "design-embed.config.mjs"),
			`export default {
	source: {
		name: "test-source",
		async run() {
			return { html: "<main>No tests</main>", diagnostics: [] };
		},
	},
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
					diagnostics: [],
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
			join(cwd, "design-embed.config.ts"),
			`export default {
	source: {
		name: "test-source",
		async run() {
			return { html: "<main>Default config</main>", diagnostics: [] };
		},
	},
	output: {
		viewsDir: "custom/generated",
	},
};
`,
			"utf-8",
		);

		const code = await runCompileCommand({
			"--cwd": cwd,
			"--quiet": true,
		});

		assert.equal(code, 0);
		assert.equal(
			readFileSync(join(cwd, "custom/generated/index.html"), "utf-8"),
			"<main>\n\tDefault config\n</main>\n",
		);
	});
});
