import type { DesignNode } from "design-embed";

export function collectImports(nodes: DesignNode[]): Array<{
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

export function collectSlotProps(node: DesignNode): Set<string> {
	const names = new Set<string>();
	function visit(current: DesignNode): void {
		if (current.kind === "slot" && current.propName) {
			names.add(current.propName);
		}
		for (const propName of Object.values(current.attributeSlots ?? {})) {
			names.add(propName);
		}
		for (const child of current.children ?? []) visit(child);
	}
	visit(node);
	return names;
}

export function collectComponentNodes(
	nodes: DesignNode[],
): Map<string, DesignNode> {
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
