export function toPascalCase(value: string): string {
	return value
		.split(/[-_\s]+/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join("");
}

export function toCamelCase(value: string): string {
	return value.replace(/-([a-z])/g, (_, letter: string) =>
		letter.toUpperCase(),
	);
}

export function toRelativeImport(fromFile: string, toFile: string): string {
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
	const relative = prefix.concat(toParts).join("/");
	return relative.startsWith(".") ? relative : `./${relative}`;
}

export function formatNumber(value: number): string {
	return Number.isInteger(value)
		? String(value)
		: String(Number(value.toFixed(4)));
}

export function sortedEntries<T>(
	record: Record<string, T>,
): Array<[string, T]> {
	return Object.entries(record).sort(([left], [right]) =>
		left.localeCompare(right),
	);
}

export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

export function escapeAttribute(value: string): string {
	return escapeHtml(value).replace(/"/g, "&quot;");
}

export function isCssModuleReference(className: string): boolean {
	return className.startsWith("module:");
}
