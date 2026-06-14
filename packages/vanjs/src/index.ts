import type {
	DesignEmbedConfig,
	DesignNode,
	Diagnostic,
	PropValue,
	TargetEmitInput,
	TargetEmitResult,
	TargetEmitter,
	TargetTestGenerateInput,
	TargetTestGenerateResult,
	TargetTestGenerator,
} from "design-embed";
import { buildHeadlessBeforeAll, buildScreenshotAssertion } from "design-embed";

export class VanJsTarget implements TargetEmitter, TargetTestGenerator {
	emit({ nodes, css, config, diagnostics }: TargetEmitInput): TargetEmitResult {
		const viewsDir = String(config?.output?.viewsDir ?? "src/generated/views");
		const viewName = config?.output?.viewName ?? "DesignView";

		const styleResult = transformStyles(nodes, css, config, diagnostics);
		const contents = emitVanJsView(styleResult.nodes, viewName, {
			cssModulePath: styleResult.cssModulePath,
		});

		const files: Array<{ path: string; contents: string }> = [
			{ path: `${viewsDir}/${viewName}.view.ts`, contents },
		];
		if (styleResult.cssModule && styleResult.cssModulePath) {
			files.push({
				path: `${viewsDir}/${styleResult.cssModulePath}`,
				contents: styleResult.cssModule,
			});
		}
		for (const split of emitComponentSplitViews(
			styleResult.nodes,
			viewsDir,
			styleResult.cssModulePath,
		)) {
			files.push(split);
		}

		return { files };
	}

	generateTests(input: TargetTestGenerateInput): TargetTestGenerateResult {
		return vanJsTestGenerator.generateTests(input);
	}
}

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
			`${T5}await page.setContent(referenceHtml);`,
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
					await page.setContent(referenceHtml);
					const isolatedHtml = await page.locator(selector).first().evaluate((node) => node.outerHTML);
					await page.setContent(isolatedHtml);
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

function emitComponentSplitViews(
	nodes: DesignNode[],
	viewsDir: string,
	cssModulePath: string | undefined,
): Array<{ path: string; contents: string }> {
	const seen = new Set<string>();
	const files: Array<{ path: string; contents: string }> = [];

	function visit(node: DesignNode): void {
		if (node.kind === "component") {
			const importName = node.importName ?? node.component ?? "";
			const childrenProp = node.props?.children;
			const innerChildren: DesignNode[] =
				childrenProp?.kind === "children"
					? childrenProp.value
					: (node.children ?? []);

			if (importName && !seen.has(importName)) {
				seen.add(importName);
				const funcName = toPascalCase(importName);
				files.push({
					path: `${viewsDir}/${importName}.view.ts`,
					contents: emitComponentView(node, funcName, { cssModulePath }),
				});
			}

			for (const child of innerChildren) {
				visit(child);
			}
		} else if (node.kind === "element") {
			for (const child of node.children ?? []) {
				visit(child);
			}
		}
	}

	for (const node of nodes) {
		visit(node);
	}
	return files;
}

function emitComponentView(
	node: DesignNode,
	funcName: string,
	options: { cssModulePath?: string } = {},
): string {
	const props = node.props ?? {};
	const source = node.sourceElement;
	const propEntries = Object.entries(props);

	const attributeBindings = new Map<string, string>();
	const interfaceLines: string[] = [];
	const destructured: string[] = [];
	let childrenPropName: string | undefined;

	for (const [propName, prop] of propEntries) {
		if (prop.kind === "text" || prop.kind === "children") {
			// Children are passed as a second argument (VanJS calling convention),
			// not as part of the props object, so exclude them from the interface.
			childrenPropName = propName;
			continue;
		}
		interfaceLines.push(`\t${propName}?: string;`);
		if (prop.kind === "literal") {
			destructured.push(propName);
			if (prop.attribute) {
				attributeBindings.set(prop.attribute, propName);
			}
		}
	}

	const body = emitComponentBody(
		node,
		source,
		attributeBindings,
		childrenPropName,
		2,
	);

	const importNodes = childrenPropName ? [] : (node.children ?? []);
	const componentImports = collectImports(importNodes)
		.map(
			({ importName, importPath }) =>
				`import { ${importName} } from "${importPath}";`,
		)
		.join("\n");
	const cssModuleImport = options.cssModulePath
		? `import styles from "./${options.cssModulePath}";`
		: "";

	const tagNames = collectTagNames(
		[node.sourceElement].filter(Boolean) as DesignNode[],
	);
	const tagsImport =
		tagNames.size > 0
			? `const { ${Array.from(tagNames).sort().join(", ")} } = van.tags;`
			: "";

	const allImports = [
		`import van from "vanjs-core";`,
		componentImports,
		cssModuleImport,
	]
		.filter(Boolean)
		.join("\n");

	const hasProps = interfaceLines.length > 0;
	const interfaceBlock = hasProps
		? `interface ${funcName}Props {\n${interfaceLines.join("\n")}\n}\n\n`
		: "";
	const propsParam =
		destructured.length > 0
			? `{ ${destructured.join(", ")} }: ${funcName}Props`
			: "";
	const childrenParam = childrenPropName ? `${childrenPropName}?: any` : "";
	const params = [propsParam, childrenParam].filter(Boolean).join(", ");

	return `${allImports}\n\n${tagsImport ? `${tagsImport}\n\n` : ""}${interfaceBlock}export function ${funcName}(${params}) {\n\treturn (\n${body}\t);\n}\n`;
}

function emitComponentBody(
	node: DesignNode,
	source: DesignNode | undefined,
	attributeBindings: Map<string, string>,
	childrenPropName: string | undefined,
	depth: number,
): string {
	const indent = "\t".repeat(depth);

	if (!source) {
		const children = node.children ?? [];
		if (children.length === 0) return `${indent}null\n`;
		if (children.length === 1) return emitVanJsNode(children[0], depth);
		return `${indent}[\n${children
			.map((child) => emitVanJsNode(child, depth + 1))
			.join("")}${indent}]\n`;
	}

	const tagName = source.tagName ?? "div";
	const attributes = emitVanJsAttributes(
		source.attributes ?? {},
		source.styles ?? {},
		source.generatedClassNames ?? [],
		attributeBindings,
	);

	if (childrenPropName) {
		const inner = `${"\t".repeat(depth + 1)}${childrenPropName}\n`;
		return `${indent}${tagName}(${attributes ? `${attributes}, ` : ""}\n${inner}${indent})\n`;
	}

	const children = node.children ?? [];
	if (children.length === 0) {
		return `${indent}${tagName}(${attributes})\n`;
	}

	return `${indent}${tagName}(${attributes ? `${attributes}, ` : ""}\n${children
		.map((child) => emitVanJsNode(child, depth + 1))
		.join("")}${indent})\n`;
}

function collectComponentNodes(nodes: DesignNode[]): Map<string, DesignNode> {
	const map = new Map<string, DesignNode>();
	function visit(list: DesignNode[]): void {
		for (const node of list) {
			if (node.kind === "component") {
				const name = node.component ?? node.importName;
				if (name && !map.has(name)) {
					map.set(name, node);
				}
				const childrenProp = node.props?.children;
				visit(
					childrenProp?.kind === "children"
						? childrenProp.value
						: (node.children ?? []),
				);
			} else if (node.kind === "element") {
				visit(node.children ?? []);
			}
		}
	}
	visit(nodes);
	return map;
}

function emitComponentMount(
	componentName: string,
	node: DesignNode | undefined,
): string {
	const attributeParts: string[] = [];
	const childrenParts: string[] = [];
	for (const [propName, prop] of Object.entries(node?.props ?? {})) {
		if (prop.kind === "text") {
			childrenParts.push(JSON.stringify(prop.value));
			continue;
		}
		if (prop.kind === "children") {
			childrenParts.push(...prop.value.map((child) => emitInlineVanJs(child)));
			continue;
		}
		const attribute = emitProp(propName, prop);
		if (attribute) {
			attributeParts.push(attribute);
		}
	}
	const attributes =
		attributeParts.length > 0 ? `{ ${attributeParts.join(", ")} }` : "";

	const args = [attributes, ...childrenParts].filter(Boolean);
	return `${componentName}(${args.join(", ")})`;
}

function emitInlineVanJs(node: DesignNode): string {
	if (node.kind === "text") {
		return JSON.stringify(node.text ?? "");
	}
	if (node.kind === "component") {
		return emitComponentMount(
			node.component ?? node.importName ?? "Component",
			node,
		);
	}
	const tagName = node.tagName ?? "div";
	const attributes = emitVanJsAttributes(
		node.attributes ?? {},
		node.styles ?? {},
		node.generatedClassNames ?? [],
	);
	const children = (node.children ?? [])
		.map((child) => emitInlineVanJs(child))
		.join(", ");
	const args = [attributes, children].filter(Boolean);
	return `${tagName}(${args.join(", ")})`;
}

function toPascalCase(value: string): string {
	return value
		.split(/[-_\s]+/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join("");
}

export function emitVanJsView(
	nodes: DesignNode[],
	viewName: string,
	options: { cssModulePath?: string } = {},
): string {
	const imports = collectImports(nodes);
	const importLines = imports
		.map(
			({ importName, importPath }) =>
				`import { ${importName} } from "${importPath}";`,
		)
		.join("\n");
	const cssModuleImport = options.cssModulePath
		? `import styles from "./${options.cssModulePath}";`
		: "";
	const tagNames = collectTagNames(nodes);
	const tagsImport =
		tagNames.size > 0
			? `const { ${Array.from(tagNames).sort().join(", ")} } = van.tags;`
			: "";

	const allImports = [
		'import van from "vanjs-core";',
		importLines,
		cssModuleImport,
	]
		.filter(Boolean)
		.join("\n");
	const body =
		nodes.length === 1 && nodes[0]?.kind !== "text"
			? emitVanJsNode(nodes[0], 2).replace(/,\n$/, "\n")
			: `${"\t".repeat(2)}[\n${nodes.map((node) => emitVanJsNode(node, 3)).join("")}${"\t".repeat(2)}]\n`;

	return `${allImports}\n\n${tagsImport ? `${tagsImport}\n\n` : ""}export function ${viewName}() {\n\treturn (\n${body}\t);\n}\n`;
}

function collectTagNames(nodes: DesignNode[]): Set<string> {
	const tags = new Set<string>();
	function visit(node: DesignNode) {
		if (node.kind === "element" && node.tagName) {
			tags.add(node.tagName);
		}
		for (const child of node.children ?? []) {
			visit(child);
		}
		if (node.sourceElement) {
			visit(node.sourceElement);
		}
		for (const prop of Object.values(node.props ?? {})) {
			if (prop.kind === "children") {
				for (const child of prop.value) {
					visit(child);
				}
			}
		}
	}
	for (const node of nodes) {
		visit(node);
	}
	return tags;
}

interface StyleTransformResult {
	nodes: DesignNode[];
	cssModule?: string;
	cssModulePath?: string;
}

interface CssRule {
	selector: string;
	declarations: Record<string, string>;
	order: number;
}

interface TokenMatch {
	group: string;
	name: string;
	value: string;
}

function transformStyles(
	nodes: DesignNode[],
	css: string | undefined,
	config: DesignEmbedConfig | undefined,
	diagnostics: Diagnostic[],
): StyleTransformResult {
	const styleMode = config?.output?.styleMode ?? "inline";
	const cssRules = parseCssRules(css, diagnostics);
	const resolvedNodes = resolveCssStyles(nodes, cssRules);

	if (styleMode === "inline") {
		return {
			nodes: mapStyleNodes(resolvedNodes, (node) => ({
				...node,
				styles: snapStyleValues(node.styles ?? {}, config, diagnostics, node),
			})),
		};
	}

	if (styleMode === "tailwind") {
		return {
			nodes: mapStyleNodes(resolvedNodes, (node) =>
				applyTailwindStyles(node, config, diagnostics),
			),
		};
	}

	if (styleMode === "css-modules") {
		const rules: string[] = [];
		let index = 0;
		const moduleNodes = mapStyleNodes(resolvedNodes, (node) => {
			const snapped = snapStyleValues(
				node.styles ?? {},
				config,
				diagnostics,
				node,
			);
			if (Object.keys(snapped).length === 0) {
				return { ...node, styles: snapped };
			}
			index += 1;
			const className = `style${index}`;
			rules.push(emitCssModuleRule(className, snapped));
			return {
				...node,
				styles: {},
				generatedClassNames: [
					...(node.generatedClassNames ?? []),
					`module:${className}`,
				],
			};
		});
		const viewName = config?.output?.viewName ?? "DesignView";
		return {
			nodes: moduleNodes,
			cssModule: rules.length > 0 ? `${rules.join("\n\n")}\n` : undefined,
			cssModulePath: rules.length > 0 ? `${viewName}.module.css` : undefined,
		};
	}

	diagnostics.push({
		code: "STYLE_MODE_UNSUPPORTED",
		message: `Unsupported style mode: ${styleMode}`,
		severity: "error",
	});
	return { nodes: resolvedNodes };
}

interface ParsedSelector {
	tagName?: string;
	id?: string;
	classes: string[];
	attributes: Record<string, string>;
}

function parseInlineStyle(style: string | undefined): Record<string, string> {
	const styles: Record<string, string> = {};
	if (!style) {
		return styles;
	}
	for (const declaration of style.split(";")) {
		const [property, ...valueParts] = declaration.split(":");
		const value = valueParts.join(":").trim();
		if (!property?.trim() || !value) {
			continue;
		}
		styles[property.trim().toLowerCase()] = value;
	}
	return styles;
}

function parseSelector(selector: string): ParsedSelector | undefined {
	const trimmed = selector.trim();
	if (!trimmed || /[\s>+~,:]/.test(trimmed)) {
		return undefined;
	}
	const parsed: ParsedSelector = { classes: [], attributes: {} };
	let rest = trimmed;
	const tagMatch = rest.match(/^[a-zA-Z][a-zA-Z0-9-]*/);
	if (tagMatch?.[0]) {
		parsed.tagName = tagMatch[0].toLowerCase();
		rest = rest.slice(tagMatch[0].length);
	}
	while (rest) {
		if (rest.startsWith(".")) {
			const match = rest.match(/^\.([a-zA-Z_][a-zA-Z0-9_-]*)/);
			if (!match?.[1]) {
				return undefined;
			}
			parsed.classes.push(match[1]);
			rest = rest.slice(match[0].length);
			continue;
		}
		if (rest.startsWith("#")) {
			const match = rest.match(/^#([a-zA-Z_][a-zA-Z0-9_-]*)/);
			if (!match?.[1] || parsed.id) {
				return undefined;
			}
			parsed.id = match[1];
			rest = rest.slice(match[0].length);
			continue;
		}
		if (rest.startsWith("[")) {
			const match = rest.match(
				/^\[([a-zA-Z_][a-zA-Z0-9_.:-]*)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]+)))?\]/,
			);
			if (!match?.[1]) {
				return undefined;
			}
			parsed.attributes[match[1]] = match[2] ?? match[3] ?? match[4] ?? "";
			rest = rest.slice(match[0].length);
			continue;
		}
		return undefined;
	}
	return parsed;
}

function matchesSelector(node: DesignNode, selector: ParsedSelector): boolean {
	if (node.kind !== "element") {
		return false;
	}
	const attributes = node.attributes ?? {};
	if (selector.tagName && node.tagName !== selector.tagName) {
		return false;
	}
	if (selector.id && attributes.id !== selector.id) {
		return false;
	}
	const classNames = new Set(
		(attributes.class ?? "").split(/\s+/).filter(Boolean),
	);
	for (const className of selector.classes) {
		if (!classNames.has(className)) {
			return false;
		}
	}
	for (const [name, value] of Object.entries(selector.attributes)) {
		if (!(name in attributes)) {
			return false;
		}
		if (value !== "" && attributes[name] !== value) {
			return false;
		}
	}
	return true;
}

function parseCssRules(
	css: string | undefined,
	diagnostics: Diagnostic[],
): CssRule[] {
	if (!css?.trim()) {
		return [];
	}
	const rules: CssRule[] = [];
	let order = 0;
	for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const selectorText = match[1]?.trim() ?? "";
		const declarations = parseInlineStyle(match[2]);
		for (const selector of selectorText.split(",").map((item) => item.trim())) {
			if (!selector) {
				continue;
			}
			if (!parseSelector(selector)) {
				diagnostics.push({
					code: "CSS_SELECTOR_UNSUPPORTED",
					message: `Unsupported CSS selector: ${selector}`,
					severity: "warning",
					selector,
				});
				continue;
			}
			rules.push({ selector, declarations, order });
			order += 1;
		}
	}
	const unsupported = css.replace(/([^{}]+)\{([^{}]*)\}/g, "").trim();
	if (unsupported) {
		diagnostics.push({
			code: "CSS_SELECTOR_UNSUPPORTED",
			message: "Unsupported CSS was ignored.",
			severity: "warning",
		});
	}
	return rules;
}

function resolveCssStyles(nodes: DesignNode[], rules: CssRule[]): DesignNode[] {
	return nodes.map((node) => {
		if (node.kind !== "element") {
			return node;
		}
		const matchedDeclarations = rules
			.filter((rule) => {
				const selector = parseSelector(rule.selector);
				return selector ? matchesSelector(node, selector) : false;
			})
			.sort((left, right) => left.order - right.order);
		const stylesFromCss: Record<string, string> = {};
		for (const rule of matchedDeclarations) {
			Object.assign(stylesFromCss, rule.declarations);
		}
		return {
			...node,
			styles: { ...stylesFromCss, ...(node.styles ?? {}) },
			children: resolveCssStyles(node.children ?? [], rules),
		};
	});
}

function mapStyleNodes(
	nodes: DesignNode[],
	mapper: (node: DesignNode) => DesignNode,
): DesignNode[] {
	return nodes.map((node) => {
		if (node.kind !== "element") {
			return node;
		}
		return mapper({
			...node,
			children: mapStyleNodes(node.children ?? [], mapper),
		});
	});
}

function applyTailwindStyles(
	node: DesignNode,
	config: DesignEmbedConfig | undefined,
	diagnostics: Diagnostic[],
): DesignNode {
	const remaining: Record<string, string> = {};
	const generatedClassNames = [...(node.generatedClassNames ?? [])];
	for (const [property, value] of sortedEntries(node.styles ?? {})) {
		const match = matchToken(property, value, config, diagnostics, node);
		if (!match) {
			remaining[property] = value;
			continue;
		}
		const className =
			config?.styleMappings?.[match.group]?.[
				`${property}:${match.group}.${match.name}`
			];
		if (className) {
			generatedClassNames.push(className);
		} else {
			remaining[property] = match.value;
			diagnostics.push({
				code: "TOKEN_NO_MATCH",
				message: `No Tailwind mapping for ${property}:${match.group}.${match.name}.`,
				severity: "info",
				source: node.source,
				property,
			});
		}
	}
	return {
		...node,
		styles: remaining,
		generatedClassNames,
	};
}

function snapStyleValues(
	styles: Record<string, string>,
	config: DesignEmbedConfig | undefined,
	diagnostics: Diagnostic[],
	node: DesignNode,
): Record<string, string> {
	const snapped: Record<string, string> = {};
	for (const [property, value] of sortedEntries(styles)) {
		const match = matchToken(property, value, config, diagnostics, node);
		snapped[property] = match?.value ?? value;
	}
	return snapped;
}

function matchToken(
	property: string,
	value: string,
	config: DesignEmbedConfig | undefined,
	diagnostics: Diagnostic[],
	node: DesignNode,
): TokenMatch | undefined {
	const group = tokenGroupForProperty(property);
	if (!group) {
		diagnostics.push({
			code: "STYLE_UNSUPPORTED_PROPERTY",
			message: `No token group is configured for CSS property "${property}".`,
			severity: "info",
			source: node.source,
			property,
		});
		return undefined;
	}
	if (group === "layout") {
		return undefined;
	}
	if (group === "colors") {
		return matchColorToken(property, value, config, diagnostics, node);
	}
	if (group === "shadow") {
		return matchStringToken(property, value, config?.tokens?.shadow, group);
	}
	const tokenValues =
		group === "spacing"
			? config?.tokens?.spacing?.values
			: group === "sizing"
				? config?.tokens?.sizing?.values
				: group === "typography"
					? config?.tokens?.typography?.values
					: group === "radius"
						? config?.tokens?.radius
						: config?.tokens?.borderWidth;
	const unit =
		group === "spacing"
			? (config?.tokens?.spacing?.unit ?? "px")
			: group === "sizing"
				? (config?.tokens?.sizing?.unit ?? "px")
				: group === "typography"
					? (config?.tokens?.typography?.unit ?? "px")
					: "px";
	const threshold =
		group === "spacing"
			? (config?.tokens?.spacing?.threshold ?? 0)
			: group === "sizing"
				? (config?.tokens?.sizing?.threshold ?? 0)
				: group === "typography"
					? (config?.tokens?.typography?.threshold ?? 0)
					: 0;
	return matchNumericToken(
		property,
		value,
		tokenValues,
		group,
		unit,
		threshold,
		diagnostics,
		node,
	);
}

const LAYOUT_PROPS = new Set([
	"display",
	"position",
	"top",
	"right",
	"bottom",
	"left",
	"flex-direction",
	"flex-wrap",
	"flex",
	"flex-grow",
	"flex-shrink",
	"flex-basis",
	"justify-content",
	"align-items",
	"align-self",
	"align-content",
	"box-sizing",
	"overflow",
	"overflow-x",
	"overflow-y",
	"opacity",
	"z-index",
	"font-family",
	"cursor",
	"pointer-events",
	"background-image",
	"background-repeat",
	"background-position",
	"background-size",
	"grid-template-columns",
	"grid-template-rows",
	"grid-column",
	"grid-row",
	"border",
]);

function tokenGroupForProperty(property: string): string | undefined {
	if (LAYOUT_PROPS.has(property)) {
		return "layout";
	}
	if (/^(margin|padding)(-|$)|^gap$|^row-gap$|^column-gap$/.test(property)) {
		return "spacing";
	}
	if (
		/^(width|height|min-width|min-height|max-width|max-height)$/.test(property)
	) {
		return "sizing";
	}
	if (/^(font-size|line-height|font-weight)$/.test(property)) {
		return "typography";
	}
	if (property === "border-radius") {
		return "radius";
	}
	if (property === "border-width") {
		return "borderWidth";
	}
	if (property === "box-shadow") {
		return "shadow";
	}
	if (
		property === "color" ||
		property === "background" ||
		property === "background-color" ||
		property === "border-color"
	) {
		return "colors";
	}
	return undefined;
}

function matchNumericToken(
	property: string,
	value: string,
	tokens: Record<string, number> | undefined,
	group: string,
	unit: "px" | "rem",
	threshold: number,
	diagnostics: Diagnostic[],
	node: DesignNode,
): TokenMatch | undefined {
	if (!tokens) {
		return undefined;
	}
	const parsed = value.match(/^(-?\d+(?:\.\d+)?)(px|rem)?$/);
	if (!parsed?.[1]) {
		return undefined;
	}
	const numericValue = Number(parsed[1]);
	const candidates = sortedEntries(tokens)
		.map(([name, tokenValue]) => ({
			name,
			tokenValue,
			distance: Math.abs(tokenValue - numericValue),
		}))
		.filter(({ distance }) => distance <= threshold)
		.sort(
			(left, right) =>
				left.distance - right.distance || left.name.localeCompare(right.name),
		);
	if (candidates.length === 0) {
		diagnostics.push({
			code: "TOKEN_NO_MATCH",
			message: `${property}: ${value} did not match a ${group} token.`,
			severity: "info",
			source: node.source,
			property,
		});
		return undefined;
	}
	if (
		candidates.length > 1 &&
		candidates[0]?.distance === candidates[1]?.distance
	) {
		diagnostics.push({
			code: "TOKEN_AMBIGUOUS_MATCH",
			message: `${property}: ${value} matches multiple ${group} tokens.`,
			severity: "error",
			source: node.source,
			property,
		});
		return undefined;
	}
	const candidate = candidates[0];
	if (!candidate) {
		return undefined;
	}
	return {
		group,
		name: candidate.name,
		value: `${formatNumber(candidate.tokenValue)}${unit}`,
	};
}

function matchColorToken(
	property: string,
	value: string,
	config: DesignEmbedConfig | undefined,
	diagnostics: Diagnostic[],
	node: DesignNode,
): TokenMatch | undefined {
	const tokens = config?.tokens?.colors;
	if (!tokens) {
		return undefined;
	}
	const color = parseColor(value);
	if (!color) {
		diagnostics.push({
			code: "COLOR_PARSE_FAILED",
			message: `Could not parse color value: ${value}`,
			severity: "warning",
			source: node.source,
			property,
		});
		return undefined;
	}
	const threshold = config?.tokens?.colorThreshold ?? 0;
	const candidates = sortedEntries(tokens)
		.map(([name, tokenValue]) => {
			const tokenColor = parseColor(tokenValue);
			return tokenColor
				? { name, tokenValue, distance: colorDistance(color, tokenColor) }
				: undefined;
		})
		.filter(
			(
				candidate,
			): candidate is {
				name: string;
				tokenValue: string;
				distance: number;
			} => Boolean(candidate && candidate.distance <= threshold),
		)
		.sort(
			(left, right) =>
				left.distance - right.distance || left.name.localeCompare(right.name),
		);
	if (candidates.length === 0) {
		diagnostics.push({
			code: "TOKEN_NO_MATCH",
			message: `${property}: ${value} did not match a color token.`,
			severity: "info",
			source: node.source,
			property,
		});
		return undefined;
	}
	if (
		candidates.length > 1 &&
		candidates[0]?.distance === candidates[1]?.distance
	) {
		diagnostics.push({
			code: "TOKEN_AMBIGUOUS_MATCH",
			message: `${property}: ${value} matches multiple color tokens.`,
			severity: "error",
			source: node.source,
			property,
		});
		return undefined;
	}
	const candidate = candidates[0];
	if (!candidate) {
		return undefined;
	}
	return {
		group: "colors",
		name: candidate.name,
		value: normalizeHex(candidate.tokenValue),
	};
}

function matchStringToken(
	_property: string,
	value: string,
	tokens: Record<string, string> | undefined,
	group: string,
): TokenMatch | undefined {
	const match = sortedEntries(tokens ?? {}).find(
		([, tokenValue]) => tokenValue === value,
	);
	if (!match) {
		return undefined;
	}
	return { group, name: match[0], value: match[1] };
}

function parseColor(value: string): [number, number, number] | undefined {
	const trimmed = value.trim();
	const hex = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (hex?.[1]) {
		const expanded =
			hex[1].length === 3
				? hex[1]
						.split("")
						.map((part) => `${part}${part}`)
						.join("")
				: hex[1];
		return [
			Number.parseInt(expanded.slice(0, 2), 16),
			Number.parseInt(expanded.slice(2, 4), 16),
			Number.parseInt(expanded.slice(4, 6), 16),
		];
	}
	const rgb = trimmed.match(
		/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i,
	);
	if (rgb?.[1] && rgb[2] && rgb[3]) {
		return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
	}
	return undefined;
}

function colorDistance(
	left: [number, number, number],
	right: [number, number, number],
): number {
	return Math.sqrt(
		(left[0] - right[0]) ** 2 +
			(left[1] - right[1]) ** 2 +
			(left[2] - right[2]) ** 2,
	);
}

function normalizeHex(value: string): string {
	const color = parseColor(value);
	if (!color) {
		return value;
	}
	return `#${color.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function emitCssModuleRule(
	className: string,
	styles: Record<string, string>,
): string {
	const declarations = sortedEntries(styles)
		.map(([property, value]) => `\t${property}: ${value};`)
		.join("\n");
	return `.${className} {\n${declarations}\n}`;
}

function sortedEntries<T>(record: Record<string, T>): Array<[string, T]> {
	return Object.entries(record).sort(([left], [right]) =>
		left.localeCompare(right),
	);
}

function formatNumber(value: number): string {
	return Number.isInteger(value)
		? String(value)
		: String(Number(value.toFixed(4)));
}

function collectImports(nodes: DesignNode[]): Array<{
	importName: string;
	importPath: string;
}> {
	const imports = new Map<string, { importName: string; importPath: string }>();
	function visit(node: DesignNode) {
		if (node.kind === "component" && node.importName && node.importPath) {
			imports.set(`${node.importPath}:${node.importName}`, {
				importName: node.importName,
				importPath: node.importPath,
			});
		}
		for (const child of node.children ?? []) {
			visit(child);
		}
		for (const prop of Object.values(node.props ?? {})) {
			if (prop.kind === "children") {
				for (const child of prop.value) {
					visit(child);
				}
			}
		}
	}
	for (const node of nodes) {
		visit(node);
	}
	return [...imports.values()].sort(
		(left, right) =>
			left.importPath.localeCompare(right.importPath) ||
			left.importName.localeCompare(right.importName),
	);
}

function emitVanJsNode(node: DesignNode | undefined, depth: number): string {
	if (!node) {
		return "";
	}
	const indent = "\t".repeat(depth);
	if (node.kind === "text") {
		return `${indent}${JSON.stringify(node.text ?? "")},\n`;
	}
	if (node.kind === "component") {
		return emitComponentVanJs(node, depth);
	}

	const tagName = node.tagName ?? "div";
	const attributes = emitVanJsAttributes(
		node.attributes ?? {},
		node.styles ?? {},
		node.generatedClassNames ?? [],
	);
	const children = node.children ?? [];

	if (attributes && children.length === 0) {
		return `${indent}${tagName}(${attributes}),\n`;
	}
	if (!attributes && children.length === 0) {
		return `${indent}${tagName}(),\n`;
	}

	return `${indent}${tagName}(${attributes ? `${attributes},` : ""}\n${children
		.map((child) => emitVanJsNode(child, depth + 1))
		.join("")}${indent}),\n`;
}

function emitComponentVanJs(node: DesignNode, depth: number): string {
	const indent = "\t".repeat(depth);
	const component = node.component ?? node.importName ?? "Component";
	const childrenProp = node.props?.children;
	const attributes = Object.entries(node.props ?? {})
		.filter(([name]) => name !== "children")
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([name, prop]) => emitProp(name, prop))
		.join(", ");
	const attrBlock = attributes ? `{ ${attributes} }` : "";

	if (childrenProp?.kind === "text") {
		return `${indent}${component}(${attrBlock ? `${attrBlock}, ` : ""}${JSON.stringify(childrenProp.value)}),\n`;
	}
	if (childrenProp?.kind === "children") {
		return `${indent}${component}(${attrBlock ? `${attrBlock}, ` : ""}\n${childrenProp.value
			.map((child) => emitVanJsNode(child, depth + 1))
			.join("")}${indent}),\n`;
	}
	const children = node.children ?? [];
	if (children.length === 0) {
		return `${indent}${component}(${attrBlock}),\n`;
	}
	return `${indent}${component}(${attrBlock ? `${attrBlock}, ` : ""}\n${children
		.map((child) => emitVanJsNode(child, depth + 1))
		.join("")}${indent}),\n`;
}

function emitProp(name: string, prop: PropValue): string {
	if (prop.kind === "children") {
		return "";
	}
	return `${name}: ${JSON.stringify(prop.value)}`;
}

function emitVanJsAttributes(
	attributes: Record<string, string>,
	styles: Record<string, string>,
	generatedClassNames: string[] = [],
	attributeBindings: Map<string, string> = new Map(),
): string {
	const mergedAttributes = { ...attributes };
	const classNames = [
		...(attributes.class ?? "").split(/\s+/).filter(Boolean),
		...generatedClassNames,
	];
	if (classNames.length > 0) {
		mergedAttributes.class = classNames.join(" ");
	}

	const entries = Object.entries(mergedAttributes)
		.filter(([name]) => name !== "style")
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([name, value]) => {
			const binding = attributeBindings.get(name);
			const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)
				? name
				: JSON.stringify(name);
			if (binding) {
				return `${key}: ${binding}`;
			}
			if (name === "class" && generatedClassNames.some(isCssModuleReference)) {
				return `${key}: ${emitClassNameExpression(classNames)}`;
			}
			return `${key}: ${JSON.stringify(value)}`;
		});

	const styleAttr = emitStyleAttribute(styles);
	if (styleAttr) {
		entries.push(`style: ${styleAttr}`);
	}

	if (entries.length === 0) {
		return "";
	}
	return `{ ${entries.join(", ")} }`;
}

function emitClassNameExpression(classNames: string[]): string {
	return `[${classNames
		.map((className) =>
			isCssModuleReference(className)
				? `styles.${className.slice("module:".length)}`
				: JSON.stringify(className),
		)
		.join(", ")}].filter(Boolean).join(" ")`;
}

function isCssModuleReference(className: string): boolean {
	return className.startsWith("module:");
}

function emitStyleAttribute(
	styles: Record<string, string>,
): string | undefined {
	const entries = Object.entries(styles).sort(([left], [right]) =>
		left.localeCompare(right),
	);
	if (entries.length === 0) {
		return undefined;
	}
	return JSON.stringify(
		entries.map(([property, value]) => `${property}: ${value};`).join(" "),
	);
}
