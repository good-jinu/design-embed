import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import type { Diagnostic } from "../diagnostics/diagnostic.ts";

export interface ScannedComponent {
	/** Component name (the PascalCase file basename). */
	name: string;
	/** Best-effort list of declared prop names. */
	props: string[];
	/** Absolute path to the component file. */
	filePath: string;
}

const COMPONENT_EXTENSIONS = new Set([".tsx", ".jsx", ".vue", ".ts"]);

/**
 * Scans a directory for hand-written components. A file is treated as a
 * component when its basename is PascalCase. Prop names are extracted on a
 * best-effort basis from a `*Props` interface/type or a Vue `defineProps`.
 * Results are deterministic (sorted by path, first name wins on collision).
 */
export function scanComponents(
	dir: string,
	diagnostics: Diagnostic[] = [],
): ScannedComponent[] {
	if (!existsSync(dir)) {
		diagnostics.push({
			code: "DETECT_COMPONENTS_DIR_MISSING",
			message: `Components directory not found, skipping map-to-existing: ${dir}`,
			severity: "warning",
		});
		return [];
	}

	const files = listFiles(dir).sort();
	const byName = new Map<string, ScannedComponent>();

	for (const filePath of files) {
		const ext = extname(filePath);
		if (!COMPONENT_EXTENSIONS.has(ext)) {
			continue;
		}
		const base = filePath.slice(
			filePath.lastIndexOf("/") + 1,
			filePath.length - ext.length,
		);
		if (!/^[A-Z][A-Za-z0-9]*$/.test(base) || byName.has(base)) {
			continue;
		}
		byName.set(base, {
			name: base,
			props: extractPropNames(readFileSafe(filePath), ext),
			filePath,
		});
	}

	return [...byName.values()];
}

function listFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...listFiles(full));
		} else if (entry.isFile()) {
			out.push(full);
		}
	}
	return out;
}

function readFileSafe(filePath: string): string {
	try {
		return readFileSync(filePath, "utf-8");
	} catch {
		return "";
	}
}

function extractPropNames(source: string, ext: string): string[] {
	const names = new Set<string>();
	const blocks: string[] = [];

	if (ext === ".vue") {
		const defineProps = source.match(/defineProps\s*<([\s\S]*?)>\s*\(/);
		if (defineProps?.[1]) blocks.push(defineProps[1]);
		const definePropsObj = source.match(
			/defineProps\s*\(\s*\{([\s\S]*?)\}\s*\)/,
		);
		if (definePropsObj?.[1]) blocks.push(definePropsObj[1]);
	} else {
		for (const match of source.matchAll(
			/(?:interface\s+\w*Props\s*|type\s+\w*Props\s*=\s*)\{([^}]*)\}/g,
		)) {
			if (match[1]) blocks.push(match[1]);
		}
	}

	for (const block of blocks) {
		for (const member of block.matchAll(/([A-Za-z_$][\w$]*)\s*[?]?\s*:/g)) {
			if (member[1]) names.add(member[1]);
		}
	}

	return [...names];
}
