import type {
	DesignNode,
	Diagnostic,
	GeneratedFile,
	PropValue,
	TargetEmitInput,
	TargetEmitResult,
	TargetEmitter,
	TargetTestGenerateInput,
	TargetTestGenerateResult,
	TargetTestGenerator,
} from "../core/index.ts";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface HtmlTargetOptions {
	domModel?: "light" | "shadow";
}

export class HtmlTarget implements TargetEmitter, TargetTestGenerator {
	private readonly domModel: "light" | "shadow";

	constructor(options: HtmlTargetOptions = {}) {
		this.domModel = options.domModel ?? "light";
	}

	emit({ nodes, css, config }: TargetEmitInput): TargetEmitResult {
		const viewsDir = String(config?.output?.viewsDir ?? "src/generated/views");
		const viewName = config?.output?.viewName ?? "index";

		const components = collectComponents(nodes);
		const scriptTag =
			components.length > 0
				? `<script type="module" src="./${viewName}.js"></script>\n`
				: "";

		const files: GeneratedFile[] = [
			{
				path: `${viewsDir}/${viewName}.html`,
				contents: emitHtml(nodes, css) + scriptTag,
			},
		];

		if (components.length > 0) {
			files.push({
				path: `${viewsDir}/${viewName}.ts`,
				contents: emitWebComponentFile(components, this.domModel),
			});
		}

		return { files };
	}

	generateTests(input: TargetTestGenerateInput): TargetTestGenerateResult {
		return htmlTestGenerator.generateTests(input);
	}
}

export const htmlTarget: TargetEmitter & TargetTestGenerator = new HtmlTarget();

export const htmlEmitter: TargetEmitter = {
	emit: (input: TargetEmitInput) => htmlTarget.emit(input),
};

// ---------------------------------------------------------------------------
// Test generator (unchanged)
// ---------------------------------------------------------------------------

const htmlTestGenerator: TargetTestGenerator = {
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

		const viewsDir = config.output?.viewsDir ?? "src/generated/views";
		const viewName = config.output?.viewName ?? "index";
		const outputDir = tests?.outputDir ?? `${viewsDir}/tests`;
		const fixturePath = `${outputDir}/${viewName}.reference.html`;
		const specPath = `${outputDir}/${viewName}.spec.ts`;
		const outputHtmlPath = `${viewsDir}/${viewName}.html`;
		const referenceHtml = `${css?.trim() ? `<style>\n${css}\n</style>\n` : ""}${html}`;

		return {
			diagnostics,
			files: [
				{
					path: fixturePath,
					contents: referenceHtml.endsWith("\n")
						? referenceHtml
						: `${referenceHtml}\n`,
				},
				{
					path: specPath,
					contents: emitHtmlVisualSpec({
						viewName,
						relativeOutputPath: toRelativeFilePath(specPath, outputHtmlPath),
						fixtureFileName: `${viewName}.reference.html`,
						viewports: tests?.viewports ?? [
							{ name: "default", width: 1440, height: 900 },
						],
						states: tests?.states ?? [{ name: "default" }],
						assertions: {
							screenshot: tests?.assertions?.screenshot ?? true,
							layout: tests?.assertions?.layout ?? true,
							layoutTolerance: tests?.assertions?.layoutTolerance ?? 0,
							selectors: tests?.assertions?.selectors ?? [":scope", ":scope *"],
						},
					}),
				},
			],
		};
	},
};

// ---------------------------------------------------------------------------
// HTML emit
// ---------------------------------------------------------------------------

function emitHtml(nodes: DesignNode[], css?: string): string {
	const body = nodes.map((node) => emitNode(node, 0)).join("");
	if (!css?.trim()) {
		return body;
	}
	return `<style>\n${css.trim()}\n</style>\n${body}\n`;
}

function emitNode(node: DesignNode, depth: number): string {
	const indent = "\t".repeat(depth);
	if (node.kind === "text") {
		return `${indent}${escapeHtml(node.text ?? "")}\n`;
	}
	if (node.kind === "component") {
		return emitComponentHtml(node, depth);
	}

	const attributes = Object.entries(node.attributes ?? {})
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([name, value]) =>
			value === "" ? name : `${name}="${escapeAttribute(value)}"`,
		)
		.join(" ");
	const openTag = attributes
		? `<${node.tagName} ${attributes}>`
		: `<${node.tagName}>`;
	const children = node.children ?? [];

	if (children.length === 0) {
		return `${indent}${openTag}</${node.tagName}>\n`;
	}

	return `${indent}${openTag}\n${children
		.map((child) => emitNode(child, depth + 1))
		.join("")}${indent}</${node.tagName}>\n`;
}

function emitComponentHtml(node: DesignNode, depth: number): string {
	const indent = "\t".repeat(depth);
	const tag = toCustomElementTag(node.component ?? "component");

	const attrParts = Object.entries(node.props ?? {})
		.filter(([name, prop]) => name !== "children" && prop.kind !== "children")
		.sort(([left], [right]) => left.localeCompare(right))
		.flatMap(([name, prop]) => {
			const part = formatPropAsAttribute(name, prop);
			return part !== null ? [part] : [];
		})
		.join(" ");
	const openTag = attrParts ? `<${tag} ${attrParts}>` : `<${tag}>`;

	const childrenProp = node.props?.children;
	if (childrenProp?.kind === "text") {
		return `${indent}${openTag}${escapeHtml(childrenProp.value)}</${tag}>\n`;
	}
	if (childrenProp?.kind === "children") {
		const kids = childrenProp.value;
		if (kids.length === 0) {
			return `${indent}${openTag}</${tag}>\n`;
		}
		return `${indent}${openTag}\n${kids
			.map((child) => emitNode(child, depth + 1))
			.join("")}${indent}</${tag}>\n`;
	}

	const children = node.children ?? [];
	if (children.length === 0) {
		return `${indent}${openTag}</${tag}>\n`;
	}
	return `${indent}${openTag}\n${children
		.map((child) => emitNode(child, depth + 1))
		.join("")}${indent}</${tag}>\n`;
}

function formatPropAsAttribute(name: string, prop: PropValue): string | null {
	if (prop.kind === "children") {
		return null;
	}
	if (prop.value === false) {
		return null;
	}
	if (prop.value === true) {
		return name;
	}
	const value = String(prop.value);
	return value === "" ? name : `${name}="${escapeAttribute(value)}"`;
}

// ---------------------------------------------------------------------------
// Web component emit
// ---------------------------------------------------------------------------

interface ComponentInfo {
	tagName: string;
	className: string;
	observedAttributes: string[];
}

function collectComponents(nodes: DesignNode[]): ComponentInfo[] {
	const seen = new Map<string, ComponentInfo>();

	function visit(node: DesignNode): void {
		if (node.kind === "component") {
			const key = `${node.importPath ?? ""}::${node.importName ?? ""}`;
			if (!seen.has(key) && node.importPath && node.importName) {
				seen.set(key, buildComponentInfo(node));
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
		} else if (node.kind === "element") {
			for (const child of node.children ?? []) {
				visit(child);
			}
		}
	}

	for (const node of nodes) {
		visit(node);
	}

	return Array.from(seen.values());
}

function buildComponentInfo(node: DesignNode): ComponentInfo {
	const importName = node.importName ?? node.component ?? "Component";
	const tagName = toCustomElementTag(importName);
	const className = toPascalCase(tagName);

	const observedAttributes: string[] = [];
	for (const [name, prop] of Object.entries(node.props ?? {})) {
		if (prop.kind === "literal") {
			observedAttributes.push(name);
		}
	}
	observedAttributes.sort();

	return { tagName, className, observedAttributes };
}

function emitWebComponentFile(
	components: ComponentInfo[],
	domModel: "light" | "shadow",
): string {
	const classes = components
		.map((c) => emitWebComponentClass(c, domModel))
		.join("\n\n");

	const registrations = components
		.map((c) => `customElements.define("${c.tagName}", ${c.className});`)
		.join("\n");

	return `${classes}\n\n${registrations}\n`;
}

function emitWebComponentClass(
	info: ComponentInfo,
	domModel: "light" | "shadow",
): string {
	const hasShadow = domModel === "shadow";
	const { className, observedAttributes } = info;

	const attrArray =
		observedAttributes.length === 0
			? "[]"
			: `[${observedAttributes.map((a) => JSON.stringify(a)).join(", ")}]`;

	const shadowSetup = hasShadow
		? `\tprivate shadow: ShadowRoot;\n\n\tconstructor() {\n\t\tsuper();\n\t\tthis.shadow = this.attachShadow({ mode: "open" });\n\t}\n\n`
		: "";

	const attrVars = observedAttributes
		.map((a) => `\t\tconst ${a} = this.getAttribute("${a}");`)
		.join("\n");

	const renderLines: string[] = [];
	if (attrVars) renderLines.push(attrVars);
	if (hasShadow)
		renderLines.push(`\t\tthis.shadow.innerHTML = \`<slot></slot>\`;`);
	const renderBody = renderLines.join("\n");

	const renderMethod = renderBody
		? `\tprivate render(): void {\n${renderBody}\n\t}`
		: `\tprivate render(): void {\n\t}`;

	return `class ${className} extends HTMLElement {
${shadowSetup}\tstatic get observedAttributes(): string[] {
\t\treturn ${attrArray};
\t}

\tconnectedCallback(): void {
\t\tthis.render();
\t}

\tattributeChangedCallback(): void {
\t\tthis.render();
\t}

${renderMethod}
}`;
}

// ---------------------------------------------------------------------------
// Playwright test generator
// ---------------------------------------------------------------------------

interface HtmlVisualSpecInput {
	viewName: string;
	relativeOutputPath: string;
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
	};
}

function emitHtmlVisualSpec(input: HtmlVisualSpecInput): string {
	const viewports = JSON.stringify(input.viewports, null, 2);
	const states = JSON.stringify(input.states, null, 2);
	const selectors = JSON.stringify(input.assertions.selectors, null, 2);
	const screenshotEnabled = JSON.stringify(input.assertions.screenshot);
	const layoutEnabled = JSON.stringify(input.assertions.layout);
	const layoutTolerance = JSON.stringify(input.assertions.layoutTolerance);

	return `import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const currentDir = dirname(fileURLToPath(import.meta.url));
const referenceHtml = readFileSync(resolve(currentDir, "./${input.fixtureFileName}"), "utf-8");
const outputHtmlPath = resolve(currentDir, "${input.relativeOutputPath}");
const viewports = ${viewports};
const states = ${states};
const selectors = ${selectors};
const screenshotEnabled = ${screenshotEnabled};
const layoutEnabled = ${layoutEnabled};
const layoutTolerance = ${layoutTolerance};

for (const viewport of viewports) {
\tfor (const state of states) {
\t\tconst viewportName = viewport.name ?? String(viewport.width) + "x" + String(viewport.height);
\t\ttest("${input.viewName} matches source at " + viewportName + " / " + state.name, async ({ page }) => {
\t\t\tawait page.setViewportSize({ width: viewport.width, height: viewport.height });

\t\t\tawait page.setContent(referenceHtml);
\t\t\tawait applyState(page, state);
\t\t\tconst expectedScreenshot = screenshotEnabled ? await page.screenshot({ fullPage: true }) : undefined;
\t\t\tconst expectedLayout = layoutEnabled ? await readLayout(page.locator("body > *").first(), selectors) : [];

\t\t\tawait page.goto("file://" + outputHtmlPath);
\t\t\tawait applyState(page, state);
\t\t\tconst actualScreenshot = screenshotEnabled ? await page.screenshot({ fullPage: true }) : undefined;
\t\t\tconst actualLayout = layoutEnabled ? await readLayout(page.locator("body > *").first(), selectors) : [];

\t\t\tif (screenshotEnabled) {
\t\t\t\texpect(actualScreenshot).toEqual(expectedScreenshot);
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
\t\treturn values.flatMap((selector) => {
\t\t\tconst matches = selector === ":scope" ? [element] : Array.from(element.querySelectorAll(selector));
\t\t\treturn matches.map((matchedElement, index) => {
\t\t\t\tconst rect = matchedElement.getBoundingClientRect();
\t\t\t\treturn {
\t\t\t\t\tselector,
\t\t\t\t\tindex,
\t\t\t\t\ttagName: matchedElement.tagName.toLowerCase(),
\t\t\t\t\tx: rect.x,
\t\t\t\t\ty: rect.y,
\t\t\t\t\twidth: rect.width,
\t\t\t\t\theight: rect.height,
\t\t\t\t};
\t\t\t});
\t\t});
\t}, selectorsToRead);
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

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function toRelativeFilePath(fromFile: string, toFile: string): string {
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

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
	return escapeHtml(value).replace(/"/g, "&quot;");
}

function toCustomElementTag(name: string): string {
	const kebab = name
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.toLowerCase()
		.replace(/^-/, "");
	return kebab.includes("-") ? kebab : `${kebab}-el`;
}

function toPascalCase(kebab: string): string {
	return kebab
		.split("-")
		.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
		.join("");
}
