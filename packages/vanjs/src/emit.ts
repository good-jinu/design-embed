import type { DesignNode, PropValue } from "design-embed";
import { collectImports, collectSlotProps } from "./nodes.ts";
import { isCssModuleReference, toPascalCase } from "./utils.ts";

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

	// Stage B (synthesized nested slots): destructure every slot prop as a string
	// and reconstruct the body from the template's slots / attributeSlots.
	const slotProps = source ? [...collectSlotProps(source)].sort() : [];
	if (source && slotProps.length > 0) {
		const body = emitComponentBody(node, source, new Map(), undefined, 2);
		const componentImports = collectImports(source.children ?? [])
			.map(
				({ importName, importPath }) =>
					`import { ${importName} } from "${importPath}";`,
			)
			.join("\n");
		const cssModuleImport = options.cssModulePath
			? `import styles from "./${options.cssModulePath}";`
			: "";
		const tagNames = collectTagNames([source]);
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
		const interfaceBlock = `interface ${funcName}Props {\n${slotProps
			.map((name) => `\t${name}?: string;`)
			.join("\n")}\n}\n\n`;
		const params = `{ ${slotProps.join(", ")} }: ${funcName}Props`;
		return `${allImports}\n\n${tagsImport ? `${tagsImport}\n\n` : ""}${interfaceBlock}export function ${funcName}(${params}) {\n\treturn (\n${body}\t);\n}\n`;
	}

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
		source.attributeSlots ?? {},
	);

	if (childrenPropName) {
		const inner = `${"\t".repeat(depth + 1)}${childrenPropName}\n`;
		return `${indent}${tagName}(${attributes ? `${attributes}, ` : ""}\n${inner}${indent})\n`;
	}

	const children = node.children ?? source.children ?? [];
	if (children.length === 0) {
		return `${indent}${tagName}(${attributes})\n`;
	}

	return `${indent}${tagName}(${attributes ? `${attributes}, ` : ""}\n${children
		.map((child) => emitVanJsNode(child, depth + 1))
		.join("")}${indent})\n`;
}

function emitVanJsNode(node: DesignNode | undefined, depth: number): string {
	if (!node) {
		return "";
	}
	const indent = "\t".repeat(depth);
	if (node.kind === "text") {
		return `${indent}${JSON.stringify(node.text ?? "")},\n`;
	}
	if (node.kind === "slot") {
		return `${indent}${node.propName},\n`;
	}
	if (node.kind === "component") {
		return emitComponentVanJs(node, depth);
	}

	const tagName = node.tagName ?? "div";
	const attributes = emitVanJsAttributes(
		node.attributes ?? {},
		node.styles ?? {},
		node.generatedClassNames ?? [],
		new Map(),
		node.attributeSlots ?? {},
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

	const entries = Object.entries(mergedAttributes)
		.filter(([name]) => name !== "style")
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([name, value]) => {
			const binding = attributeBindings.get(name) ?? attributeSlots[name];
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

export function emitComponentMount(
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
