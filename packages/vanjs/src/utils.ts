export function toPascalCase(value: string): string {
	return value
		.split(/[-_\s]+/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join("");
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

export function isCssModuleReference(className: string): boolean {
	return className.startsWith("module:");
}
