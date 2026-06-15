import { relative } from "node:path";
import type { DesignNode, PropValue } from "../nodes.ts";
import type { ScannedComponent } from "./scan.ts";
import {
	classNamesOf,
	collectText,
	isTextOnly,
	toCamelCase,
	toPascalCase,
} from "./util.ts";

const RESERVED_ATTRS = new Set(["class", "style", "data-component"]);

/**
 * Converts element nodes that correspond to a user's existing components into
 * `external` component nodes. Matching is heuristic and name-based: candidate
 * names are derived from `data-component`, class names, and the tag, then
 * looked up against the scanned component set.
 */
export function matchExisting(
	nodes: DesignNode[],
	scanned: ScannedComponent[],
	viewsDir: string,
): DesignNode[] {
	if (scanned.length === 0) {
		return nodes;
	}
	const index = new Map(scanned.map((c) => [c.name.toLowerCase(), c]));

	function visit(node: DesignNode): DesignNode {
		if (node.kind !== "element") {
			return node;
		}
		const match = findMatch(node, index);
		if (!match) {
			return { ...node, children: (node.children ?? []).map(visit) };
		}

		const props = deriveProps(node, match);
		const childrenProp = props.children;
		return {
			kind: "component",
			component: match.name,
			importName: match.name,
			importPath: toImportSpecifier(viewsDir, match.filePath),
			external: true,
			props,
			children:
				childrenProp?.kind === "children" || childrenProp?.kind === "text"
					? undefined
					: (node.children ?? []).map(visit),
			source: node.source,
		};
	}

	return nodes.map(visit);
}

function findMatch(
	node: DesignNode,
	index: Map<string, ScannedComponent>,
): ScannedComponent | undefined {
	const candidates = [
		node.attributes?.["data-component"],
		...classNamesOf(node),
		node.tagName,
	];
	for (const candidate of candidates) {
		if (!candidate) continue;
		const hit = index.get(toPascalCase(candidate).toLowerCase());
		if (hit) return hit;
	}
	return undefined;
}

function deriveProps(
	node: DesignNode,
	component: ScannedComponent,
): Record<string, PropValue> {
	const props: Record<string, PropValue> = {};
	const propSet = new Set(component.props.map((p) => p.toLowerCase()));

	for (const [attr, value] of Object.entries(node.attributes ?? {})) {
		if (RESERVED_ATTRS.has(attr)) continue;
		const propName = toCamelCase(attr);
		// Only bind attributes the component appears to declare as props, unless
		// we could not learn its props at all (then bind nothing — safer).
		if (propSet.has(propName.toLowerCase())) {
			props[propName] = { kind: "literal", value, attribute: attr };
		}
	}

	const text = collectText(node);
	if (isTextOnly(node)) {
		if (text) props.children = { kind: "text", value: text };
	} else if ((node.children ?? []).length > 0) {
		props.children = { kind: "children", value: node.children ?? [] };
	}

	return props;
}

function toImportSpecifier(fromDir: string, toFile: string): string {
	let rel = relative(fromDir, toFile).replace(/\\/g, "/");
	if (!rel.endsWith(".vue")) {
		rel = rel.replace(/\.(tsx|ts|jsx|js)$/, "");
	}
	if (!rel.startsWith(".")) {
		rel = `./${rel}`;
	}
	return rel;
}
