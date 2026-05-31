import {
	applyComponentMappings,
	type DesignEmbedConfig,
	type DesignNode,
	type Diagnostic,
	type PropValue,
	parseHtml,
	type TargetEmitInput,
	type TargetEmitResult,
	type TargetEmitter,
	type TargetTestGenerateInput,
	type TargetTestGenerateResult,
	type TargetTestGenerator,
} from "design-embed";

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
		html,
		css,
		config,
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
					viewImportPath: toRelativeImport(
						specPath,
						`${viewsDir}/${viewName}.view`,
					),
					fixtureFileName: referenceHtmlFileName,
					viewports: viewportDefaults,
					states: stateDefaults,
					assertions: assertionDefaults,
				}),
			},
		];

		const componentNodes = collectComponentNodes(
			applyComponentMappings(parseHtml(html), config.components ?? []),
		);

		for (const mapping of config.components ?? []) {
			const componentName = mapping.component;
			const componentSpecPath = `${outputDir}/${componentName}.visual.spec.ts`;
			const mountNode = componentNodes.get(componentName);
			files.push({
				path: componentSpecPath,
				contents: emitComponentVisualSpec({
					componentName,
					selector: mapping.selector,
					mountExpression: emitComponentMount(componentName, mountNode),
					componentImportPath: toRelativeImport(
						componentSpecPath,
						`${viewsDir}/${componentName}.view`,
					),
					referenceHtmlFileName,
					viewports: viewportDefaults,
					states: stateDefaults,
					assertions: assertionDefaults,
				}),
			});
		}

		return { diagnostics, files };
	},
};

interface VanJsVisualSpecInput {
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
}

function emitVanJsVisualSpec(input: VanJsVisualSpecInput): string {
	const viewports = JSON.stringify(input.viewports, null, 2);
	const states = JSON.stringify(input.states, null, 2);
	const selectors = JSON.stringify(input.assertions.selectors, null, 2);
	const screenshotEnabled = JSON.stringify(input.assertions.screenshot);
	const layoutEnabled = JSON.stringify(input.assertions.layout);
	const layoutTolerance = JSON.stringify(input.assertions.layoutTolerance);
	const screenshotThreshold = JSON.stringify(
		input.assertions.screenshotThreshold,
	);
	const screenshotMaxDiffPixels = JSON.stringify(
		input.assertions.screenshotMaxDiffPixels,
	);

	return `import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const referenceHtml = readFileSync(resolve(currentDir, "./${input.fixtureFileName}"), "utf-8");
const viewports = ${viewports};
const states = ${states};
const selectors = ${selectors};
const screenshotEnabled = ${screenshotEnabled};
const layoutEnabled = ${layoutEnabled};
const layoutTolerance = ${layoutTolerance};
const screenshotThreshold = ${screenshotThreshold};
const screenshotMaxDiffPixels = ${screenshotMaxDiffPixels};

// Helper to inject VanJS and the component into the page
async function mountVanJs(page, importPath, componentName) {
  await page.addScriptTag({ content: \`
    import van from 'https://cdn.jsdelivr.net/gh/vanjs-org/van/public/van-1.5.0.min.js';
    import { \${componentName} } from '\${importPath}';
    van.add(document.body, \${componentName}());
  \`, type: 'module' });
}

for (const viewport of viewports) {
\tfor (const state of states) {
\t\tconst viewportName = viewport.name ?? String(viewport.width) + "x" + String(viewport.height);
\t\ttest("${input.viewName} matches source at " + viewportName + " / " + state.name, async ({ page }) => {
\t\t\tawait page.setViewportSize({ width: viewport.width, height: viewport.height });

\t\t\tawait page.setContent(referenceHtml);
\t\t\tawait applyState(page, state);
\t\t\tconst expectedScreenshot = screenshotEnabled ? await page.screenshot({ fullPage: true }) : undefined;
\t\t\tconst expectedLayout = layoutEnabled ? await readLayout(page.locator("body > *").first(), selectors) : [];

\t\t\tawait page.setContent("<!DOCTYPE html><html><body></body></html>");
      // In a real environment, you'd use a bundler. For tests, we assume the file is accessible or served.
      // This is a simplified mount for demonstration.
      await mountVanJs(page, "${input.viewImportPath}", "${input.viewName}");

\t\t\tawait applyState(page, state);
\t\t\tconst component = page.locator("body > *").first();
\t\t\tconst actualScreenshot = screenshotEnabled ? await page.screenshot({ fullPage: true }) : undefined;
\t\t\tconst actualLayout = layoutEnabled ? await readLayout(component, selectors) : [];

\t\t\tif (screenshotEnabled) {
\t\t\t\tcompareScreenshots(actualScreenshot, expectedScreenshot, screenshotThreshold, screenshotMaxDiffPixels);
\t\t\t}
\t\t\tif (layoutEnabled) {
\t\t\t\texpectLayoutToMatch(actualLayout, expectedLayout, layoutTolerance);
\t\t\t}
\t\t});
\t}
}

async function applyState(page, state) {
\tif (state.waitFor) {
\t\tawait page.waitForSelector(state.waitFor);
\t}
\tif (state.hover) {
\t\tawait page.hover(state.hover);
\t}
\tif (state.focus) {
\t\tawait page.focus(state.focus);
\t}
\tif (state.click) {
\t\tawait page.click(state.click);
\t}
}

async function readLayout(root, selectorsToRead) {
\treturn root.evaluate((element, values) => {
\t\tconst origin = element.getBoundingClientRect();
\t\treturn values.flatMap((selector) => {
\t\t\tconst matches = selector === ":scope" ? [element] : Array.from(element.querySelectorAll(selector));
\t\t\treturn matches.map((matchedElement, index) => {
\t\t\t\tconst rect = matchedElement.getBoundingClientRect();
\t\t\t\treturn {
\t\t\t\t\tselector,
\t\t\t\t\tindex,
\t\t\t\t\ttagName: matchedElement.tagName.toLowerCase(),
\t\t\t\t\tx: rect.x - origin.x,
\t\t\t\t\ty: rect.y - origin.y,
\t\t\t\t\twidth: rect.width,
\t\t\t\t\theight: rect.height,
\t\t\t\t};
\t\t\t});
\t\t});
\t}, selectorsToRead);
}

function compareScreenshots(actual, expected, threshold, maxDiffPixels) {
\tif (!actual || !expected) {
\t\texpect(actual).toEqual(expected);
\t\treturn;
\t}
\tconst actualPng = PNG.sync.read(actual);
\tconst expectedPng = PNG.sync.read(expected);
\texpect(actualPng.width, "screenshot width").toBe(expectedPng.width);
\texpect(actualPng.height, "screenshot height").toBe(expectedPng.height);
\tconst diffPixels = pixelmatch(actualPng.data, expectedPng.data, null, actualPng.width, actualPng.height, { threshold });
\texpect(diffPixels, "screenshot pixels differing beyond threshold").toBeLessThanOrEqual(maxDiffPixels);
}

function expectLayoutToMatch(actual, expected, tolerance) {
\texpect(actual.length).toBe(expected.length);
\tfor (let index = 0; index < expected.length; index += 1) {
\t\tconst actualRect = actual[index];
\t\tconst expectedRect = expected[index];
\t\texpect(actualRect.selector).toBe(expectedRect.selector);
\t\texpect(actualRect.index).toBe(expectedRect.index);
\t\texpect(actualRect.tagName).toBe(expectedRect.tagName);
\t\tfor (const key of ["x", "y", "width", "height"]) {
\t\t\tconst drift = Math.abs(actualRect[key] - expectedRect[key]);
\t\t\texpect(drift, \`\${expectedRect.selector}[\${expectedRect.index}] \${key} drift\`).toBeLessThanOrEqual(tolerance);
\t\t}
\t}
}
`;
}

interface ComponentVisualSpecInput {
	componentName: string;
	selector: string;
	mountExpression: string;
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
	const selectors = JSON.stringify(input.assertions.selectors, null, 2);
	const screenshotEnabled = JSON.stringify(input.assertions.screenshot);
	const layoutEnabled = JSON.stringify(input.assertions.layout);
	const layoutTolerance = JSON.stringify(input.assertions.layoutTolerance);
	const screenshotThreshold = JSON.stringify(
		input.assertions.screenshotThreshold,
	);
	const screenshotMaxDiffPixels = JSON.stringify(
		input.assertions.screenshotMaxDiffPixels,
	);
	const selector = JSON.stringify(input.selector);

	return `import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const referenceHtml = readFileSync(resolve(currentDir, "./${input.referenceHtmlFileName}"), "utf-8");
const selector = ${selector};
const viewports = ${viewports};
const states = ${states};
const selectors = ${selectors};
const screenshotEnabled = ${screenshotEnabled};
const layoutEnabled = ${layoutEnabled};
const layoutTolerance = ${layoutTolerance};
const screenshotThreshold = ${screenshotThreshold};
const screenshotMaxDiffPixels = ${screenshotMaxDiffPixels};

async function mountVanJs(page, importPath, componentName, mountExpr) {
  await page.addScriptTag({ content: \`
    import van from 'https://cdn.jsdelivr.net/gh/vanjs-org/van/public/van-1.5.0.min.js';
    import { \${componentName} } from '\${importPath}';
    van.add(document.body, \${mountExpr});
  \`, type: 'module' });
}

for (const viewport of viewports) {
\tfor (const state of states) {
\t\tconst viewportName = viewport.name ?? String(viewport.width) + "x" + String(viewport.height);
\t\ttest("${input.componentName} matches source at " + viewportName + " / " + state.name, async ({ page }) => {
\t\t\tawait page.setViewportSize({ width: viewport.width, height: viewport.height });

\t\t\tawait page.setContent(referenceHtml);
\t\t\tconst isolatedHtml = await page.locator(selector).first().evaluate((node) => node.outerHTML);
\t\t\tawait page.setContent(isolatedHtml);
\t\t\tawait applyState(page, state);
\t\t\tconst expectedEl = page.locator(selector).first();
\t\t\tconst expectedScreenshot = screenshotEnabled ? await expectedEl.screenshot() : undefined;
\t\t\tconst expectedLayout = layoutEnabled ? await readLayout(expectedEl, selectors) : [];

\t\t\tawait page.setContent("<!DOCTYPE html><html><body></body></html>");
      await mountVanJs(page, "${input.componentImportPath}", "${input.componentName}", \`${input.mountExpression}\`);
\t\t\tawait applyState(page, state);
      const component = page.locator("body > *").first();
\t\t\tconst actualScreenshot = screenshotEnabled ? await component.screenshot() : undefined;
\t\t\tconst actualLayout = layoutEnabled ? await readLayout(component, selectors) : [];

\t\t\tif (screenshotEnabled) {
\t\t\t\tcompareScreenshots(actualScreenshot, expectedScreenshot, screenshotThreshold, screenshotMaxDiffPixels);
\t\t\t}
\t\t\tif (layoutEnabled) {
\t\t\t\texpectLayoutToMatch(actualLayout, expectedLayout, layoutTolerance);
\t\t\t}
\t\t});
\t}
}

async function applyState(page, state) {
\tif (state.waitFor) {
\t\tawait page.waitForSelector(state.waitFor);
\t}
\tif (state.hover) {
\t\tawait page.hover(state.hover);
\t}
\tif (state.focus) {
\t\tawait page.focus(state.focus);
\t}
\tif (state.click) {
\t\tawait page.click(state.click);
\t}
}

async function readLayout(root, selectorsToRead) {
\treturn root.evaluate((element, values) => {
\t\tconst origin = element.getBoundingClientRect();
\t\treturn values.flatMap((selector) => {
\t\t\tconst matches = selector === ":scope" ? [element] : Array.from(element.querySelectorAll(selector));
\t\t\treturn matches.map((matchedElement, index) => {
\t\t\t\tconst rect = matchedElement.getBoundingClientRect();
\t\t\t\treturn {
\t\t\t\t\tselector,
\t\t\t\t\tindex,
\t\t\t\t\ttagName: matchedElement.tagName.toLowerCase(),
\t\t\t\t\tx: rect.x - origin.x,
\t\t\t\t\ty: rect.y - origin.y,
\t\t\t\t\twidth: rect.width,
\t\t\t\t\theight: rect.height,
\t\t\t\t};
\t\t\t});
\t\t});
\t}, selectorsToRead);
}

function compareScreenshots(actual, expected, threshold, maxDiffPixels) {
\tif (!actual || !expected) {
\t\texpect(actual).toEqual(expected);
\t\treturn;
\t}
\tconst actualPng = PNG.sync.read(actual);
\tconst expectedPng = PNG.sync.read(expected);
\texpect(actualPng.width, "screenshot width").toBe(expectedPng.width);
\texpect(actualPng.height, "screenshot height").toBe(expectedPng.height);
	const diffPixels = pixelmatch(actualPng.data, expectedPng.data, null, actualPng.width, actualPng.height, { threshold });
\texpect(diffPixels, "screenshot pixels differing beyond threshold").toBeLessThanOrEqual(maxDiffPixels);
}

function expectLayoutToMatch(actual, expected, tolerance) {
\texpect(actual.length).toBe(expected.length);
\tfor (let index = 0; index < expected.length; index += 1) {
\t\tconst actualRect = actual[index];
\t\tconst expectedRect = expected[index];
\t\texpect(actualRect.selector).toBe(expectedRect.selector);
\t\texpect(actualRect.index).toBe(expectedRect.index);
\t\texpect(actualRect.tagName).toBe(expectedRect.tagName);
\t\tfor (const key of ["x", "y", "width", "height"]) {
\t\t\tconst drift = Math.abs(actualRect[key] - expectedRect[key]);
\t\t\texpect(drift, \`\${expectedRect.selector}[\${expectedRect.index}] \${key} drift\`).toBeLessThanOrEqual(tolerance);
\t\t}
\t}
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
			childrenPropName = propName;
			interfaceLines.push(`\t${propName}?: any;`);
			destructured.push(propName);
			continue;
		}
		interfaceLines.push(`\t${propName}?: string;`);
		if (prop.kind === "literal" && prop.attribute) {
			attributeBindings.set(prop.attribute, propName);
			destructured.push(propName);
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

  const tagNames = collectTagNames([node.sourceElement].filter(Boolean) as DesignNode[]);
  const tagsImport = tagNames.size > 0 ? `const { ${Array.from(tagNames).sort().join(", ")} } = van.tags;` : "";

	const allImports = [
    `import van from "vanjs-core";`,
    componentImports,
    cssModuleImport
  ]
		.filter(Boolean)
		.join("\n");

	const hasProps = propEntries.length > 0;
	const interfaceBlock = hasProps
		? `interface ${funcName}Props {\n${interfaceLines.join("\n")}\n}\n\n`
		: "";
	const params =
		destructured.length > 0
			? `{ ${destructured.join(", ")} }: ${funcName}Props`
			: "";

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

function toRelativeImport(fromFile: string, toFile: string): string {
	const fromParts = fromFile.split("/").slice(0, -1);
	const toParts = toFile.split("/");
	while (
		fromParts.length > 0 &&
		toParts.length > 0 &&
		fromParts[0] === toParts[0]
	) {
		fromParts.shift();
		toParts.shift();
	}
	const prefix = fromParts.map(() => "..");
	const relative = [...prefix, ...toParts].join("/");
	return relative.startsWith(".") ? relative : `./${relative}`;
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

function tokenGroupForProperty(property: string): string | undefined {
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

function emitStyleAttribute(styles: Record<string, string>): string | undefined {
	const entries = Object.entries(styles).sort(([left], [right]) =>
		left.localeCompare(right),
	);
	if (entries.length === 0) {
		return undefined;
	}
	return JSON.stringify(entries.map(([property, value]) => `${property}: ${value};`).join(" "));
}
