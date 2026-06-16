import type {
	Diagnostic,
	TargetTestGenerateInput,
	TargetTestGenerateResult,
	TargetTestGenerator,
} from "design-embed";
import { buildHeadlessBeforeAll, buildScreenshotAssertion } from "design-embed";
import { emitComponentMount } from "./emit.ts";
import { collectComponentNodes } from "./nodes.ts";

export const vanJsTestGenerator: TargetTestGenerator = {
	generateTests({
		nodes,
		html,
		css,
		config,
		snapshotPath,
	}: TargetTestGenerateInput): TargetTestGenerateResult {
		const diagnostics: Diagnostic[] = [];
		const tests = config.tests;
		if (tests?.runner && tests.runner !== "playwright") {
			diagnostics.push({
				code: "TEST_RUNNER_UNSUPPORTED",
				message: `Unsupported test runner: ${tests.runner}`,
				severity: "error",
			});
			return { files: [], diagnostics };
		}

		const viewsDir = String(config.output?.viewsDir ?? "src/generated/views");
		const viewName = config.output?.viewName ?? "DesignView";
		const outputDir = tests?.outputDir ?? `${viewsDir}/tests`;
		const fixturePath = `${outputDir}/${viewName}.reference.html`;
		const specPath = `${outputDir}/${viewName}.visual.spec.ts`;
		const referenceHtml = `${css?.trim() ? `<style>\n${css}\n</style>\n` : ""}${html}`;

		const assertionDefaults = {
			screenshot: tests?.assertions?.screenshot ?? true,
			layout: tests?.assertions?.layout ?? true,
			layoutTolerance: tests?.assertions?.layoutTolerance ?? 1,
			selectors: tests?.assertions?.selectors ?? [":scope", ":scope *"],
			screenshotThreshold: tests?.assertions?.screenshotThreshold ?? 0.2,
			screenshotMaxDiffPixels:
				tests?.assertions?.screenshotMaxDiffPixels ?? 500,
		};
		const viewportDefaults = tests?.viewports ?? [
			{ name: "default", width: 1440, height: 900 },
		];
		const stateDefaults = tests?.states ?? [{ name: "default" }];
		const referenceHtmlFileName = `${viewName}.reference.html`;

		const files: Array<{ path: string; contents: string }> = [
			{
				path: fixturePath,
				contents: referenceHtml.endsWith("\n")
					? referenceHtml
					: `${referenceHtml}\n`,
			},
			{
				path: specPath,
				contents: emitVanJsVisualSpec({
					viewName,
					fixtureFileName: referenceHtmlFileName,
					viewports: viewportDefaults,
					states: stateDefaults,
					assertions: assertionDefaults,
					snapshotPath,
					snapshotMode: config.snapshot?.mode,
					sourceHtml: html,
					snapshotDir: config.snapshot?.dir,
				}),
			},
			{
				path: `${viewsDir}/${viewName}.mount.entry.ts`,
				contents: `import van from "vanjs-core";\nimport { ${viewName} } from "./${viewName}.view";\nvan.add(document.body, ${viewName}());\n`,
			},
		];

		const componentNodes = collectComponentNodes(nodes);

		for (const mapping of config.components ?? []) {
			const componentName = mapping.component;
			const componentSpecPath = `${outputDir}/${componentName}.visual.spec.ts`;
			const mountNode = componentNodes.get(componentName);
			const mountExpression = emitComponentMount(componentName, mountNode);
			files.push({
				path: componentSpecPath,
				contents: emitComponentVisualSpec({
					componentName,
					selector: mapping.selector,
					referenceHtmlFileName,
					viewports: viewportDefaults,
					states: stateDefaults,
					assertions: assertionDefaults,
				}),
			});
			files.push({
				path: `${viewsDir}/${componentName}.mount.entry.ts`,
				contents: `import van from "vanjs-core";\nimport { ${componentName} } from "./${componentName}.view";\nvan.add(document.body, ${mountExpression});\n`,
			});
		}

		return { diagnostics, files };
	},
};

interface VanJsVisualSpecInput {
	viewName: string;
	fixtureFileName: string;
	viewports: Array<{ name?: string; width: number; height: number }>;
	states: Array<{
		name: string;
		hover?: string;
		focus?: string;
		click?: string;
		waitFor?: string;
	}>;
	assertions: {
		screenshot: boolean;
		layout: boolean;
		layoutTolerance: number;
		selectors: string[];
		screenshotThreshold: number;
		screenshotMaxDiffPixels: number;
	};
	snapshotPath: string | null;
	snapshotMode?: string;
	sourceHtml: string;
	snapshotDir?: string;
}

function emitVanJsVisualSpec(input: VanJsVisualSpecInput): string {
	const { snapshotPath, snapshotMode, sourceHtml, snapshotDir } = input;
	const viewports = JSON.stringify(input.viewports, null, 2);
	const states = JSON.stringify(input.states, null, 2);
	const screenshotThreshold = JSON.stringify(
		input.assertions.screenshotThreshold,
	);
	const screenshotMaxDiffPixels = JSON.stringify(
		input.assertions.screenshotMaxDiffPixels,
	);

	const useExternalBaseline = snapshotPath !== null;
	const useHeadless = snapshotMode === "headless";

	const fsImport =
		!useExternalBaseline && !useHeadless
			? `import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";\n`
			: `import { readFileSync } from "node:fs";\n`;

	const screenshotAssertion = buildScreenshotAssertion(
		snapshotPath,
		input.assertions.screenshotThreshold,
		input.assertions.screenshotMaxDiffPixels,
	);

	const snapshotFilePath = `${snapshotDir ?? "__snapshots__"}/${input.viewName}.png`;
	const headlessBeforeAllBlock = useHeadless
		? `\n${buildHeadlessBeforeAll(sourceHtml, snapshotFilePath)}\n`
		: "";

	const snapshotDirComment = useExternalBaseline
		? `\n\t\t\t\t// Baseline snapshot directory: ${snapshotDir ?? "__snapshots__"} — configure snapshotDir in playwright.config.ts`
		: "";

	// Build test body as explicit lines to avoid indentation issues with embedded blocks
	const T4 = "\t\t\t\t";
	const T5 = "\t\t\t\t\t";
	const testBodyLines: string[] = [];
	if (!useExternalBaseline && !useHeadless) {
		testBodyLines.push(
			`${T4}const snapshotName = \`${input.viewName}-\${viewport.name ?? \`\${viewport.width}x\${viewport.height}\`}-\${state.name}.png\`;`,
			`${T4}const snapshotPath = testInfo.snapshotPath(snapshotName);`,
			``,
			`${T4}if (!existsSync(snapshotPath)) {`,
			`${T5}testInfo.annotations.push({ type: "init", description: "Snapshot initialized from reference HTML" });`,
			`${T5}await page.setContent(\`<!DOCTYPE html>\${referenceHtml}\`);`,
			`${T5}await stripWhitespaceTextNodes(page);`,
			`${T5}await applyState(page, state);`,
			`${T5}const locator = page.locator("body > *").first();`,
			`${T5}mkdirSync(dirname(snapshotPath), { recursive: true });`,
			`${T5}writeFileSync(snapshotPath, await locator.screenshot());`,
			`${T5}return;`,
			`${T4}}`,
			``,
		);
	}
	testBodyLines.push(
		`${T4}await page.goto("file://" + mountHtmlPath);`,
		`${T4}await page.waitForSelector("body > *");`,
		`${T4}await applyState(page, state);`,
		`${T4}const locator = page.locator("body > *").first();${snapshotDirComment}`,
		`${T4}${screenshotAssertion}`,
	);
	const testBody = testBodyLines.join("\n");

	const stripFn =
		!useExternalBaseline && !useHeadless
			? `
async function stripWhitespaceTextNodes(page) {
	await page.evaluate(() => {
		function strip(node) {
			for (const child of [...node.childNodes]) {
				if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? "").trim() === "") {
					child.parentNode?.removeChild(child);
				} else {
					strip(child);
				}
			}
		}
		strip(document.body);
	});
}
`
			: "";

	return `${fsImport}import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const referenceHtml = readFileSync(resolve(currentDir, "./${input.fixtureFileName}"), "utf-8");
const mountHtmlPath = resolve(currentDir, "../${input.viewName}.mount.html");
const viewports = ${viewports};
const states = ${states};
const screenshotThreshold = ${screenshotThreshold};
const screenshotMaxDiffPixels = ${screenshotMaxDiffPixels};
${headlessBeforeAllBlock}
for (const viewport of viewports) {
	test.describe(\`\${viewport.name ?? \`\${viewport.width}x\${viewport.height}\`}\`, () => {
		test.use({ viewport: { width: viewport.width, height: viewport.height } });
		for (const state of states) {
			test(\`Visual Regression / \${state.name}\`, async ({ page }, testInfo) => {
${testBody}
			});
		}
	});
}
${stripFn}
async function applyState(page, state) {
	if (state.waitFor) {
		await page.waitForSelector(state.waitFor);
	}
	if (state.hover) {
		await page.hover(state.hover);
	}
	if (state.focus) {
		await page.focus(state.focus);
	}
	if (state.click) {
		await page.click(state.click);
	}
}
`;
}

interface ComponentVisualSpecInput {
	componentName: string;
	selector: string;
	referenceHtmlFileName: string;
	viewports: Array<{ name?: string; width: number; height: number }>;
	states: Array<{
		name: string;
		hover?: string;
		focus?: string;
		click?: string;
		waitFor?: string;
	}>;
	assertions: {
		screenshot: boolean;
		layout: boolean;
		layoutTolerance: number;
		selectors: string[];
		screenshotThreshold: number;
		screenshotMaxDiffPixels: number;
	};
}

function emitComponentVisualSpec(input: ComponentVisualSpecInput): string {
	const viewports = JSON.stringify(input.viewports, null, 2);
	const states = JSON.stringify(input.states, null, 2);
	const screenshotThreshold = JSON.stringify(
		input.assertions.screenshotThreshold,
	);
	const screenshotMaxDiffPixels = JSON.stringify(
		input.assertions.screenshotMaxDiffPixels,
	);
	const selector = JSON.stringify(input.selector);

	return `import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const referenceHtml = readFileSync(resolve(currentDir, "./${input.referenceHtmlFileName}"), "utf-8");
const mountHtmlPath = resolve(currentDir, "../${input.componentName}.mount.html");
const selector = ${selector};
const viewports = ${viewports};
const states = ${states};
const screenshotThreshold = ${screenshotThreshold};
const screenshotMaxDiffPixels = ${screenshotMaxDiffPixels};

for (const viewport of viewports) {
	test.describe(\`\${viewport.name ?? \`\${viewport.width}x\${viewport.height}\`}\`, () => {
		test.use({ viewport: { width: viewport.width, height: viewport.height } });
		for (const state of states) {
			test(\`Visual Regression / \${state.name}\`, async ({ page }, testInfo) => {
				const snapshotName = \`${input.componentName}-\${viewport.name ?? \`\${viewport.width}x\${viewport.height}\`}-\${state.name}.png\`;
				const snapshotPath = testInfo.snapshotPath(snapshotName);

				if (!existsSync(snapshotPath)) {
					testInfo.annotations.push({ type: "init", description: "Snapshot initialized from reference HTML" });
					await page.setContent('<!DOCTYPE html>' + referenceHtml);
					const isolatedHtml = await page.locator(selector).first().evaluate((node) => node.outerHTML);
					await page.setContent('<!DOCTYPE html>' + isolatedHtml);
					await applyState(page, state);
					const locator = page.locator("body > *").first();
					mkdirSync(dirname(snapshotPath), { recursive: true });
					writeFileSync(snapshotPath, await locator.screenshot());
					return;
				}

				await page.goto("file://" + mountHtmlPath);
				await page.waitForSelector("body > *");
				await applyState(page, state);
				const locator = page.locator("body > *").first();
				await expect(locator).toHaveScreenshot(snapshotName, {
					threshold: screenshotThreshold,
					maxDiffPixels: screenshotMaxDiffPixels,
				});
			});
		}
	});
}

async function applyState(page, state) {
	if (state.waitFor) {
		await page.waitForSelector(state.waitFor);
	}
	if (state.hover) {
		await page.hover(state.hover);
	}
	if (state.focus) {
		await page.focus(state.focus);
	}
	if (state.click) {
		await page.click(state.click);
	}
}
`;
}
