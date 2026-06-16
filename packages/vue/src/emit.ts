import type { DesignNode, PropValue } from "design-embed";
import { collectImports, collectSlotProps } from "./nodes.ts";
import {
	escapeAttribute,
	escapeHtml,
	isCssModuleReference,
	toCamelCase,
	toPascalCase,
} from "./utils.ts";

export function emitVueView(
	nodes: DesignNode[],
	_viewName: string,
	options: {
		cssModule?: string;
		api?: "composition" | "options";
	} = {},
): string {
	const api = options.api ?? "composition";
	const isComponentImplementation =
		nodes.length === 1 && nodes[0]?.kind === "component";
	const componentNode = isComponentImplementation ? nodes[0] : undefined;

	let script = "";
	let template = "";

	if (componentNode) {
		const props = componentNode.props ?? {};
		const source = componentNode.sourceElement;
		const propEntries = Object.entries(props);

		const slotPropNames = source ? [...collectSlotProps(source)].sort() : [];
		if (source && slotPropNames.length > 0) {
			// Stage B: body reconstructed from the template's slots / attributeSlots.
			const imports = collectImports(source.children ?? []);
			const importLines = imports
				.map(
					({ importName, importPath }) =>
						"import " +
						importName +
						' from "' +
						importPath.replace(/\.(view|tsx)$/, ".vue") +
						'";',
				)
				.join("\n");
			if (api === "composition") {
				script =
					'<script setup lang="ts">\n' +
					importLines +
					(importLines ? "\n" : "") +
					"defineProps<{\n" +
					slotPropNames.map((p) => `\t${p}?: string;`).join("\n") +
					"\n}>();\n</script>\n";
			} else {
				script =
					'<script lang="ts">\nimport { defineComponent } from "vue";\n' +
					importLines +
					(importLines ? "\n" : "") +
					"export default defineComponent({\n\tcomponents: { " +
					imports.map((i) => i.importName).join(", ") +
					" },\n\tprops: {\n\t\t" +
					slotPropNames.map((p) => `${p}: String`).join(",\n\t\t") +
					"\n\t}\n});\n</script>\n";
			}
			template = `<template>\n${emitVueNode(source, 1)}</template>\n`;
		} else {
			const attributeBindings = new Map<string, string>();
			const propsDefinitions: string[] = [];
			let childrenPropName: string | undefined;

			for (const [propName, prop] of propEntries) {
				if (prop.kind === "text" || prop.kind === "children") {
					childrenPropName = propName;
					propsDefinitions.push(`${propName}: {}`);
					continue;
				}
				propsDefinitions.push(`${propName}: String`);
				if (prop.kind === "literal" && prop.attribute) {
					attributeBindings.set(prop.attribute, propName);
				}
			}

			const imports = collectImports(
				childrenPropName ? [] : (componentNode.children ?? []),
			);
			const importLines = imports
				.map(
					({ importName, importPath }) =>
						"import " +
						importName +
						' from "' +
						importPath.replace(/\.(view|tsx)$/, ".vue") +
						'";',
				)
				.join("\n");

			if (api === "composition") {
				script =
					'<script setup lang="ts">\n' +
					importLines +
					(importLines ? "\n" : "") +
					"defineProps<{\n" +
					Object.keys(props)
						.map((p) => `\t${p}?: any;`)
						.join("\n") +
					"\n}>();\n</script>\n";
			} else {
				script =
					'<script lang="ts">\nimport { defineComponent } from "vue";\n' +
					importLines +
					(importLines ? "\n" : "") +
					"export default defineComponent({\n\tcomponents: { " +
					imports.map((i) => i.importName).join(", ") +
					" },\n\tprops: {\n\t\t" +
					propsDefinitions.join(",\n\t\t") +
					"\n\t}\n});\n</script>\n";
			}

			template =
				"<template>\n" +
				emitVueComponentBody(
					componentNode,
					source,
					attributeBindings,
					childrenPropName,
					1,
				) +
				"</template>\n";
		}
	} else {
		const imports = collectImports(nodes);
		const importLines = imports
			.map(
				({ importName, importPath }) =>
					"import " +
					importName +
					' from "' +
					importPath.replace(/\.(view|tsx)$/, ".vue") +
					'";',
			)
			.join("\n");

		if (api === "composition") {
			script = importLines
				? `<script setup lang="ts">\n${importLines}\n</script>\n`
				: "";
		} else {
			script =
				'<script lang="ts">\nimport { defineComponent } from "vue";\n' +
				importLines +
				(importLines ? "\n" : "") +
				"export default defineComponent({\n\tcomponents: { " +
				imports.map((i) => i.importName).join(", ") +
				" }\n});\n</script>\n";
		}

		const body =
			nodes.length === 1 && nodes[0]?.kind !== "text"
				? emitVueNode(nodes[0], 1)
				: '\t<template v-if="true">\n' +
					nodes.map((node) => emitVueNode(node, 2)).join("") +
					"\t</template>\n";

		template = `<template>\n${body}</template>\n`;
	}

	const style = options.cssModule
		? `\n<style module>\n${options.cssModule}</style>\n`
		: "";

	return `${script}\n${template}${style}`;
}

export function emitComponentSplitViews(
	nodes: DesignNode[],
	viewsDir: string,
	api: "composition" | "options" | undefined,
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
					path: `${viewsDir}/${importName}.vue`,
					contents: emitVueView([node], funcName, { api }),
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

function emitVueComponentBody(
	node: DesignNode,
	source: DesignNode | undefined,
	attributeBindings: Map<string, string>,
	childrenPropName: string | undefined,
	depth: number,
): string {
	const indent = "\t".repeat(depth);

	if (!source) {
		const children = node.children ?? [];
		return (
			indent +
			'<template v-if="true">\n' +
			children.map((child) => emitVueNode(child, depth + 1)).join("") +
			indent +
			"</template>\n"
		);
	}

	const tagName = source.tagName ?? "div";
	const attributes = emitVueAttributes(
		source.attributes ?? {},
		source.styles ?? {},
		source.generatedClassNames ?? [],
		attributeBindings,
		source.attributeSlots ?? {},
	);
	const openTag = attributes ? `<${tagName} ${attributes}>` : `<${tagName}>`;

	if (childrenPropName) {
		const inner =
			"\t".repeat(depth + 1) +
			'<slot name="' +
			childrenPropName +
			'">{{ ' +
			childrenPropName +
			" }}</slot>\n";
		return `${indent + openTag}\n${inner}${indent}</${tagName}>\n`;
	}

	const children = node.children ?? source.children ?? [];
	if (children.length === 0) {
		return `${indent + openTag}</${tagName}>\n`;
	}

	return (
		indent +
		openTag +
		"\n" +
		children.map((child) => emitVueNode(child, depth + 1)).join("") +
		indent +
		"</" +
		tagName +
		">\n"
	);
}

function emitVueNode(node: DesignNode | undefined, depth: number): string {
	if (!node) {
		return "";
	}
	const indent = "\t".repeat(depth);
	if (node.kind === "text") {
		return `${indent + escapeHtml(node.text ?? "")}\n`;
	}
	if (node.kind === "slot") {
		return `${indent}{{ ${node.propName} }}\n`;
	}
	if (node.kind === "component") {
		return emitVueComponentJsx(node, depth);
	}

	const tagName = node.tagName ?? "div";
	const attributes = emitVueAttributes(
		node.attributes ?? {},
		node.styles ?? {},
		node.generatedClassNames ?? [],
		new Map(),
		node.attributeSlots ?? {},
	);
	const children = node.children ?? [];
	const openTag = attributes ? `<${tagName} ${attributes}>` : `<${tagName}>`;
	if (children.length === 0) {
		return `${indent + openTag}</${tagName}>\n`;
	}

	return (
		indent +
		openTag +
		"\n" +
		children.map((child) => emitVueNode(child, depth + 1)).join("") +
		indent +
		"</" +
		tagName +
		">\n"
	);
}

function emitVueComponentJsx(node: DesignNode, depth: number): string {
	const indent = "\t".repeat(depth);
	const component = node.component ?? node.importName ?? "Component";
	const childrenProp = node.props?.children;
	const attributes = Object.entries(node.props ?? {})
		.filter(([name]) => name !== "children")
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([name, prop]) => emitVueProp(name, prop))
		.join(" ");
	const openTag = attributes
		? `<${component} ${attributes}>`
		: `<${component}>`;

	if (childrenProp?.kind === "text") {
		return (
			indent +
			openTag +
			"\n" +
			"\t".repeat(depth + 1) +
			"<template #children>" +
			escapeHtml(childrenProp.value) +
			"</template>\n" +
			indent +
			"</" +
			component +
			">\n"
		);
	}
	if (childrenProp?.kind === "children") {
		return (
			indent +
			openTag +
			"\n" +
			"\t".repeat(depth + 1) +
			"<template #children>\n" +
			childrenProp.value
				.map((child) => emitVueNode(child, depth + 2))
				.join("") +
			"\t".repeat(depth + 1) +
			"</template>\n" +
			indent +
			"</" +
			component +
			">\n"
		);
	}
	const children = node.children ?? [];
	if (children.length === 0) {
		return `${indent + openTag}</${component}>\n`;
	}
	return (
		indent +
		openTag +
		"\n" +
		children.map((child) => emitVueNode(child, depth + 1)).join("") +
		indent +
		"</" +
		component +
		">\n"
	);
}

function emitVueProp(name: string, prop: PropValue): string {
	if (prop.kind === "children") {
		return "";
	}
	if (typeof prop.value === "boolean" || typeof prop.value === "number") {
		return `:${name}="${JSON.stringify(prop.value).replace(/"/g, "'")}"`;
	}
	return `${name}="${escapeAttribute(prop.value)}"`;
}

function emitVueAttributes(
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

	const result = Object.entries(mergedAttributes)
		.filter(([name]) => name !== "style")
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([name, value]) => {
			const binding = attributeBindings.get(name) ?? attributeSlots[name];
			if (binding) {
				return `:${name}="${binding}"`;
			}
			if (value === "") {
				return name;
			}
			if (name === "class" && generatedClassNames.some(isCssModuleReference)) {
				return `:class="${emitVueClassNameExpression(classNames)}"`;
			}
			return `${name}="${escapeAttribute(value)}"`;
		});

	const styleAttr = emitVueStyleAttribute(styles);
	if (styleAttr) {
		result.push(styleAttr);
	}

	return result.join(" ");
}

function emitVueClassNameExpression(classNames: string[]): string {
	return (
		"[" +
		classNames
			.map((className) =>
				isCssModuleReference(className)
					? `$style.${className.slice(7)}`
					: JSON.stringify(className),
			)
			.join(", ") +
		"].filter(Boolean).join(' ')"
	);
}

function emitVueStyleAttribute(
	styles: Record<string, string>,
): string | undefined {
	const entries = Object.entries(styles).sort(([left], [right]) =>
		left.localeCompare(right),
	);
	if (entries.length === 0) {
		return undefined;
	}
	const styleObject = entries
		.map(
			([property, value]) =>
				"'" +
				toCamelCase(property) +
				"': " +
				JSON.stringify(value).replace(/"/g, "'"),
		)
		.join(", ");
	return `:style="{ ${styleObject} }"`;
}

export function emitComponentMountInfo(
	_componentName: string,
	node: DesignNode | undefined,
): { props: Record<string, unknown>; slots: Record<string, string> } {
	const props: Record<string, unknown> = {};
	const slots: Record<string, string> = {};
	for (const [propName, prop] of Object.entries(node?.props ?? {})) {
		if (prop.kind === "text") {
			slots[propName] = prop.value;
			continue;
		}
		if (prop.kind === "children") {
			slots[propName] = prop.value
				.map((child) => emitInlineVue(child))
				.join("");
			continue;
		}
		props[propName] = prop.value;
	}
	return { props, slots };
}

function emitInlineVue(node: DesignNode): string {
	if (node.kind === "text") {
		return escapeHtml(node.text ?? "");
	}
	if (node.kind === "component") {
		const info = emitComponentMountInfo(node.component ?? "Component", node);
		const propsStr = Object.entries(info.props)
			.map(([k, v]) => `${k}="${String(v)}"`)
			.join(" ");
		const slotsStr = Object.entries(info.slots)
			.map(([k, v]) => `<template #${k}>${v}</template>`)
			.join("");
		return (
			"<" +
			node.component +
			" " +
			propsStr +
			">" +
			slotsStr +
			"</" +
			node.component +
			">"
		);
	}
	const tagName = node.tagName ?? "div";
	const attributes = emitVueAttributes(
		node.attributes ?? {},
		node.styles ?? {},
		node.generatedClassNames ?? [],
	);
	const openTag = attributes ? `<${tagName} ${attributes}>` : `<${tagName}>`;
	const children = (node.children ?? [])
		.map((child) => emitInlineVue(child))
		.join("");
	return `${openTag + children}</${tagName}>`;
}
