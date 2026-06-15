import type { Diagnostic } from "../diagnostics/diagnostic.ts";
import type { DesignNode } from "../nodes.ts";
import type { ResolvedDetectConfig } from "../types.ts";
import { matchExisting } from "./matchExisting.ts";
import { scanComponents } from "./scan.ts";
import { synthesizeComponents } from "./synthesize.ts";

export { fingerprint } from "./fingerprint.ts";
export { matchExisting } from "./matchExisting.ts";
export type { ScannedComponent } from "./scan.ts";
export { scanComponents } from "./scan.ts";
export { synthesizeComponents } from "./synthesize.ts";

/**
 * Heuristically detects components in a parsed design AST and rewrites matched
 * element subtrees into component nodes. Runs two passes, in order, so an
 * existing-component match always wins over synthesis:
 *
 * 1. map-to-existing — recognize HTML corresponding to the user's hand-written
 *    components (scanned from `componentsDir`) and reference them.
 * 2. synthesize-new — extract repeated structures into new generated components.
 *
 * Only `element` nodes are touched, so manual `components` mappings (already
 * applied upstream as `component` nodes) take precedence.
 */
export function detectComponents(
	nodes: DesignNode[],
	config: ResolvedDetectConfig,
	viewsDir: string,
	diagnostics: Diagnostic[] = [],
): DesignNode[] {
	const scanned = scanComponents(config.componentsDir, diagnostics);
	const mapped = matchExisting(nodes, scanned, viewsDir);
	return synthesizeComponents(mapped, {
		minOccurrences: config.minOccurrences,
		minSubtreeSize: config.minSubtreeSize,
	});
}
