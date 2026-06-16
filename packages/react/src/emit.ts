import type { DesignNode, PropValue } from "design-embed";
import { collectImports, collectSlotProps } from "./nodes.ts";
import {
	escapeAttribute,
	escapeJsxText,
	isCssModuleReference,
	toCamelCase,
	toJsxAttributeName,
	toPascalCase,
} from "./utils.ts";

export function emitReactView(
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
	const allImports = [importLines, cssModuleImport].filter(Boolean).join("\n");
	const body =
		nodes.length === 1 && nodes[0]?.kind !== "text"
			? emitJsxNode(nodes[0], 2)
			: `${"\t".repeat(2)}<>\n${nodes.map((node) => emitJsxNode(node, 3)).join("")}${"\t".repeat(2)}</>\n`;

	return `${allImports ? `${allImports}\n\n` : ""}export function ${viewName}() {\n\treturn (\n${body}\t);\n}\n`;
}

export function emitComponentSplitViews(
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

			if (importName && !node.external && !seen.has(importName)) {
				seen.add(importName);
				const funcName = toPascalCase(importName);
				files.push({
					path: `${viewsDir}/${importName}.view.tsx`,
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

/**
 * Emits the implementation of a mapped component. The component reconstructs
 * the original element (tag, attributes, styles) captured in `sourceElement`,
 * exposes the mapping's props as a typed interface, and wires `children` and
 * `$attr.*` props into the rendered element.
 */
function emitComponentView(
	node: DesignNode,
	funcName: string,
	options: { cssModulePath?: string } = {},
): string {
	const props = node.props ?? {};
	const source = node.sourceElement;
	const propEntries = Object.entries(props);

	// Stage B (synthesized nested slots): the body is reconstructed directly
	// from the template, which carries `slot` nodes and `attributeSlots`. Every
	// slot prop is a string passed in by the call site.
	const slotProps = source ? [...collectSlotProps(source)].sort() : [];
	if (source && slotProps.length > 0) {
		const interfaceBlock = `interface ${funcName}Props {\n${slotProps
			.map((name) => `\t${name}?: string;`)
			.join("\n")}\n}\n\n`;
		const params = `{ ${slotProps.join(", ")} }: ${funcName}Props`;
		const componentImports = collectImports(source.children ?? [])
			.map(
				({ importName, importPath }) =>
					`import { ${importName} } from "${importPath}";`,
			)
			.join("\n");
		const cssModuleImport = options.cssModulePath
			? `import styles from "./${options.cssModulePath}";`
			: "";
		const allImports = [componentImports, cssModuleImport]
			.filter(Boolean)
			.join("\n");
		const body = emitJsxNode(source, 2);
		return `${allImports ? `${allImports}\n\n` : ""}${interfaceBlock}export function ${funcName}(${params}) {\n\treturn (\n${body}\t);\n}\n`;
	}

	// Classify props into an attribute binding (attr name -> prop name), the
	// children prop, and the destructured parameter list (props referenced by
	// the body). Plain literal props are documented in the interface but are
	// not destructured because they are not rendered.
	const attributeBindings = new Map<string, string>();
	const interfaceLines: string[] = [];
	const destructured: string[] = [];
	let childrenPropName: string | undefined;

	for (const [propName, prop] of propEntries) {
		if (prop.kind === "text" || prop.kind === "children") {
			childrenPropName = propName;
			interfaceLines.push(`\t${propName}?: ReactNode;`);
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
	const reactImport = childrenPropName
		? `import type { ReactNode } from "react";`
		: "";
	const cssModuleImport = options.cssModulePath
		? `import styles from "./${options.cssModulePath}";`
		: "";
	const allImports = [reactImport, componentImports, cssModuleImport]
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

	return `${allImports ? `${allImports}\n\n` : ""}${interfaceBlock}export function ${funcName}(${params}) {\n\treturn (\n${body}\t);\n}\n`;
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
		// Fall back to rendering the mapped children as a fragment when the
		// original element was not captured.
		const children = node.children ?? [];
		return `${indent}<>\n${children
			.map((child) => emitJsxNode(child, depth + 1))
			.join("")}${indent}</>\n`;
	}

	const tagName = source.tagName ?? "div";
	const attributes = emitJsxAttributes(
		source.attributes ?? {},
		source.styles ?? {},
		source.generatedClassNames ?? [],
		attributeBindings,
		source.attributeSlots ?? {},
	);
	const openTag = attributes ? `<${tagName} ${attributes}>` : `<${tagName}>`;

	if (childrenPropName) {
		const inner = `${"\t".repeat(depth + 1)}{${childrenPropName}}\n`;
		return `${indent}${openTag}\n${inner}${indent}</${tagName}>\n`;
	}

	const children = node.children ?? source.children ?? [];
	if (children.length === 0) {
		return `${indent}${attributes ? `<${tagName} ${attributes} />` : `<${tagName} />`}\n`;
	}

	return `${indent}${openTag}\n${children
		.map((child) => emitJsxNode(child, depth + 1))
		.join("")}${indent}</${tagName}>\n`;
}

function emitJsxNode(node: DesignNode | undefined, depth: number): string {
	if (!node) {
		return "";
	}
	const indent = "\t".repeat(depth);
	if (node.kind === "text") {
		return `${indent}${escapeJsxText(node.text ?? "")}\n`;
	}
	if (node.kind === "slot") {
		return `${indent}{${node.propName}}\n`;
	}
	if (node.kind === "component") {
		return emitComponentJsx(node, depth);
	}

	const tagName = node.tagName ?? "div";
	const attributes = emitJsxAttributes(
		node.attributes ?? {},
		node.styles ?? {},
		node.generatedClassNames ?? [],
		new Map(),
		node.attributeSlots ?? {},
	);
	const children = node.children ?? [];
	const openTag = attributes ? `<${tagName} ${attributes}>` : `<${tagName}>`;
	if (children.length === 0) {
		return `${indent}${openTag}</${tagName}>\n`;
	}

	return `${indent}${openTag}\n${children
		.map((child) => emitJsxNode(child, depth + 1))
		.join("")}${indent}</${tagName}>\n`;
}

function emitComponentJsx(node: DesignNode, depth: number): string {
	const indent = "\t".repeat(depth);
	const component = node.component ?? node.importName ?? "Component";
	const childrenProp = node.props?.children;
	const attributes = Object.entries(node.props ?? {})
		.filter(([name]) => name !== "children")
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([name, prop]) => emitProp(name, prop))
		.join(" ");
	const openTag = attributes
		? `<${component} ${attributes}>`
		: `<${component}>`;

	if (childrenProp?.kind === "text") {
		return `${indent}${openTag}${escapeJsxText(childrenProp.value)}</${component}>\n`;
	}
	if (childrenProp?.kind === "children") {
		return `${indent}${openTag}\n${childrenProp.value
			.map((child) => emitJsxNode(child, depth + 1))
			.join("")}${indent}</${component}>\n`;
	}
	const children = node.children ?? [];
	if (children.length === 0) {
		return `${indent}${openTag}</${component}>\n`;
	}
	return `${indent}${openTag}\n${children
		.map((child) => emitJsxNode(child, depth + 1))
		.join("")}${indent}</${component}>\n`;
}

function emitProp(name: string, prop: PropValue): string {
	if (prop.kind === "children") {
		return "";
	}
	if (typeof prop.value === "boolean" || typeof prop.value === "number") {
		return `${name}={${JSON.stringify(prop.value)}}`;
	}
	return `${name}="${escapeAttribute(prop.value)}"`;
}

function emitJsxAttributes(
	attributes: Record<string, string>,
	styles: Record<string, string>,
	generatedClassNames: string[] = [],
	attributeBindings: Map<string, string> = new Map(),
	attributeSlots: Record<string, string> = {},
): string {
	const mergedAttributes = { ...attributes };
	const classNames = [
		...(attributes.class ?? "").split(/\s+/).filter(Boolean),
		...generatedClassNames,
	];
	if (classNames.length > 0) {
		mergedAttributes.class = classNames.join(" ");
	}

	return Object.entries(mergedAttributes)
		.filter(([name]) => name !== "style")
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([name, value]) => {
			const jsxName = toJsxAttributeName(name);
			const binding = attributeBindings.get(name) ?? attributeSlots[name];
			if (binding) {
				return `${jsxName}={${binding}}`;
			}
			if (value === "") {
				return jsxName;
			}
			if (name === "class" && generatedClassNames.some(isCssModuleReference)) {
				return `${jsxName}={${emitClassNameExpression(classNames)}}`;
			}
			return `${jsxName}="${escapeAttribute(value)}"`;
		})
		.concat(emitStyleAttribute(styles))
		.filter(Boolean)
		.join(" ");
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

function emitStyleAttribute(styles: Record<string, string>): string[] {
	const entries = Object.entries(styles).sort(([left], [right]) =>
		left.localeCompare(right),
	);
	if (entries.length === 0) {
		return [];
	}
	const styleObject = entries
		.map(
			([property, value]) =>
				`${toCamelCase(property)}: ${JSON.stringify(value)}`,
		)
		.join(", ");
	return [`style={{ ${styleObject} }}`];
}

/**
 * Emits the JSX used to mount a component in its visual test, forwarding the
 * literal/attribute props as attributes and the text/children prop as the
 * element body so the rendered component matches the source design.
 */
export function emitComponentMount(
	componentName: string,
	node: DesignNode | undefined,
): string {
	const attributeParts: string[] = [];
	let childrenJsx = "";
	for (const [propName, prop] of Object.entries(node?.props ?? {})) {
		if (prop.kind === "text") {
			childrenJsx = escapeJsxText(prop.value);
			continue;
		}
		if (prop.kind === "children") {
			childrenJsx = prop.value.map((child) => emitInlineJsx(child)).join("");
			continue;
		}
		const attribute = emitProp(propName, prop);
		if (attribute) {
			attributeParts.push(attribute);
		}
	}
	const attributes =
		attributeParts.length > 0 ? ` ${attributeParts.join(" ")}` : "";
	return childrenJsx
		? `<${componentName}${attributes}>${childrenJsx}</${componentName}>`
		: `<${componentName}${attributes} />`;
}

/** Renders a node as single-line JSX for use inside a mount expression. */
function emitInlineJsx(node: DesignNode): string {
	if (node.kind === "text") {
		return escapeJsxText(node.text ?? "");
	}
	if (node.kind === "component") {
		return emitComponentMount(
			node.component ?? node.importName ?? "Component",
			node,
		);
	}
	const tagName = node.tagName ?? "div";
	const attributes = emitJsxAttributes(
		node.attributes ?? {},
		node.styles ?? {},
		node.generatedClassNames ?? [],
	);
	const openTag = attributes ? `<${tagName} ${attributes}>` : `<${tagName}>`;
	const children = (node.children ?? [])
		.map((child) => emitInlineJsx(child))
		.join("");
	return `${openTag}${children}</${tagName}>`;
}
