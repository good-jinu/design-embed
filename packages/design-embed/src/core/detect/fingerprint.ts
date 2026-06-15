import type { DesignNode } from "../nodes.ts";
import { classNamesOf } from "./util.ts";

/**
 * A structural signature of a subtree, ignoring text content and volatile
 * attributes (everything but tag and class skeleton). Two subtrees with the
 * same fingerprint are candidates for extraction into one component.
 */
export function fingerprint(node: DesignNode): string {
	if (node.kind === "text") {
		return "#text";
	}
	if (node.kind !== "element") {
		return `#${node.kind}`;
	}
	const tag = node.tagName ?? "div";
	const classes = classNamesOf(node).slice().sort().join(".");
	const children = (node.children ?? [])
		.filter((child) => child.kind === "element")
		.map(fingerprint)
		.join(",");
	return `${tag}[${classes}](${children})`;
}
