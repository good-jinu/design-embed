import type {
	DesignNode,
	TargetEmitInput,
	TargetEmitResult,
	TargetEmitter,
} from "@design-embed/core";

export function emitHtmlDebug(nodes: DesignNode[], css?: string): string {
	const body = nodes.map((node) => emitNode(node, 0)).join("");
	if (!css?.trim()) {
		return body;
	}
	return `<style>\n${css.trim()}\n</style>\n${body}\n`;
}

export const htmlEmitter: TargetEmitter = {
	emit({ nodes, css, config }: TargetEmitInput): TargetEmitResult {
		const viewsDir = config?.output?.viewsDir ?? "src/generated/views";
		return {
			files: [
				{
					path: `${viewsDir}/debug.html`,
					contents: emitHtmlDebug(nodes, css),
				},
			],
		};
	},
};

function emitNode(node: DesignNode, depth: number): string {
	const indent = "\t".repeat(depth);
	if (node.kind === "text") {
		return `${indent}${escapeHtml(node.text ?? "")}\n`;
	}
	if (node.kind === "component") {
		return `${indent}<${node.component}></${node.component}>\n`;
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

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
	return escapeHtml(value).replace(/"/g, "&quot;");
}
