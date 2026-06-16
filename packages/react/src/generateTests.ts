import type {
	Diagnostic,
	TargetTestGenerateInput,
	TargetTestGenerateResult,
	TargetTestGenerator,
} from "design-embed";
import { buildHeadlessBeforeAll, buildScreenshotAssertion } from "design-embed";
import { emitComponentMount } from "./emit.ts";
import {
	collectComponentNodes,
	findNodeBySelector,
	serializeNodeToHtml,
} from "./nodes.ts";
import { toRelativeImport } from "./utils.ts";

export const reactTestGenerator: TargetTestGenerator = {
	generateTests({
		nodes,
		sourceNodes,
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
		const specPath = `${outputDir}/${viewName}.visual.spec.tsx`;
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
				contents: emitReactVisualSpec({
					viewName,
					viewImportPath: toRelativeImport(
						specPath,
						`${viewsDir}/${viewName}.view`,
					),
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
		];

		const componentNodes = collectComponentNodes(nodes);

		for (const mapping of config.components ?? []) {
			const componentName = mapping.component;
			const componentSpecPath = `${outputDir}/${componentName}.visual.spec.tsx`;
			const componentReferenceHtmlFileName = `${componentName}.reference.html`;
			const componentFixturePath = `${outputDir}/${componentReferenceHtmlFileName}`;
			const matchingNode = findNodeBySelector(sourceNodes, mapping.selector);
			const elementHtml = matchingNode ? serializeNodeToHtml(matchingNode) : "";
			const componentReferenceHtml = `${css?.trim() ? `<style>\n${css}\n</style>\n` : ""}${elementHtml}`;
			const mountNode = componentNodes.get(componentName);
			files.push({
				path: componentFixturePath,
				contents: componentReferenceHtml.endsWith("\n")
					? componentReferenceHtml
					: `${componentReferenceHtml}\n`,
			});
			files.push({
				path: componentSpecPath,
				contents: emitComponentVisualSpec({
					componentName,
					selector: mapping.selector,
					mountJsx: emitComponentMount(componentName, mountNode),
					componentImportPath: toRelativeImport(
						componentSpecPath,
						`${viewsDir}/${componentName}.view`,
					),
					referenceHtmlFileName: componentReferenceHtmlFileName,
					viewports: viewportDefaults,
					states: stateDefaults,
					assertions: assertionDefaults,
				}),
			});
		}

		return { diagnostics, files };
	},
};

interface ReactVisualSpecInput {
	viewName: string;
	viewImportPath: string;
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

function emitReactVisualSpec(input: ReactVisualSpecInput): string {
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
			? `import { existsSync, mkdirSync, writeFileSync } from "node:fs";\nimport { dirname } from "node:path";\n`
			: ``;

	const screenshotAssertion = buildScreenshotAssertion(
		snapshotPath,
		input.assertions.screenshotThreshold,
		input.assertions.screenshotMaxDiffPixels,
		"component",
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
			`${T4}const component = await mount(<${input.viewName} />);`,
			`${T4}await applyState(component.page(), state);`,
			``,
			`${T4}if (!existsSync(snapshotPath)) {`,
			`${T5}await component.page().evaluate(() => document.fonts.ready);`,
			`${T5}mkdirSync(dirname(snapshotPath), { recursive: true });`,
			`${T5}writeFileSync(snapshotPath, await component.screenshot({ animations: "disabled" }));`,
			`${T5}return;`,
			`${T4}}`,
			``,
			`${T4}await expect(component).toHaveScreenshot(snapshotName, { threshold: screenshotThreshold, maxDiffPixels: screenshotMaxDiffPixels });`,
		);
	} else {
		testBodyLines.push(
			`${T4}const component = await mount(<${input.viewName} />);`,
			`${T4}await applyState(component.page(), state);${snapshotDirComment}`,
			`${T4}${screenshotAssertion}`,
		);
	}
	const testBody = testBodyLines.join("\n");

	return `${fsImport}import { expect, test } from "@playwright/experimental-ct-react";
import { ${input.viewName} } from "${input.viewImportPath}";

const viewports = ${viewports};
const states = ${states};
const screenshotThreshold = ${screenshotThreshold};
const screenshotMaxDiffPixels = ${screenshotMaxDiffPixels};
${headlessBeforeAllBlock}
for (const viewport of viewports) {
	test.describe(\`\${viewport.name ?? \`\${viewport.width}x\${viewport.height}\`}\`, () => {
		test.use({ viewport: { width: viewport.width, height: viewport.height } });
		for (const state of states) {
			test(\`Visual Regression / \${state.name}\`, async ({ mount }, testInfo) => {
${testBody}
			});
		}
	});
}

async function applyState(page, state) {
	if (state.waitFor) await page.waitForSelector(state.waitFor);
	if (state.hover) await page.hover(state.hover);
	if (state.focus) await page.focus(state.focus);
	if (state.click) await page.click(state.click);
}
`;
}

interface ComponentVisualSpecInput {
	componentName: string;
	selector: string;
	mountJsx: string;
	componentImportPath: string;
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

	return `import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { expect, test } from "@playwright/experimental-ct-react";
import { ${input.componentName} } from "${input.componentImportPath}";

const viewports = ${viewports};
const states = ${states};
const screenshotThreshold = ${screenshotThreshold};
const screenshotMaxDiffPixels = ${screenshotMaxDiffPixels};

for (const viewport of viewports) {
	test.describe(\`\${viewport.name ?? \`\${viewport.width}x\${viewport.height}\`}\`, () => {
		test.use({ viewport: { width: viewport.width, height: viewport.height } });
		for (const state of states) {
			test(\`Visual Regression / \${state.name}\`, async ({ mount }, testInfo) => {
				const snapshotName = \`${input.componentName}-\${viewport.name ?? \`\${viewport.width}x\${viewport.height}\`}-\${state.name}.png\`;
				const snapshotPath = testInfo.snapshotPath(snapshotName);
				const component = await mount(${input.mountJsx});
				await applyState(component.page(), state);

				if (!existsSync(snapshotPath)) {
					await component.page().evaluate(() => document.fonts.ready);
					mkdirSync(dirname(snapshotPath), { recursive: true });
					writeFileSync(snapshotPath, await component.screenshot({ animations: "disabled" }));
					return;
				}

				await expect(component).toHaveScreenshot(snapshotName, {
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
