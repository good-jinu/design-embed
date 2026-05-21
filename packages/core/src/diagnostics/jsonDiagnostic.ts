import type { Diagnostic } from "./diagnostic.ts";

export interface JsonDiagnostic {
	code: string;
	severity: "error" | "warning" | "info";
	message: string;
	file?: string;
	line?: number;
	column?: number;
	details?: Record<string, unknown>;
}

export function toJsonDiagnostic(diagnostic: Diagnostic): JsonDiagnostic {
	const details = {
		...diagnostic.details,
		...(diagnostic.selector ? { selector: diagnostic.selector } : {}),
		...(diagnostic.property ? { property: diagnostic.property } : {}),
	};

	return {
		code: diagnostic.code,
		severity: diagnostic.severity,
		message: redactSecrets(diagnostic.message),
		...(diagnostic.file ? { file: diagnostic.file } : {}),
		...(diagnostic.source ? { line: diagnostic.source.line } : {}),
		...(diagnostic.source ? { column: diagnostic.source.column } : {}),
		...(Object.keys(details).length > 0 ? { details } : {}),
	};
}

export function toJsonDiagnostics(diagnostics: Diagnostic[]): JsonDiagnostic[] {
	return diagnostics.map(toJsonDiagnostic);
}

export function formatDiagnosticText(diagnostic: Diagnostic): string {
	const location = [
		diagnostic.file,
		diagnostic.source?.line,
		diagnostic.source?.column,
	]
		.filter((part) => part !== undefined)
		.join(":");
	const prefix = location ? `${location}: ` : "";
	return `${prefix}${diagnostic.severity}: ${diagnostic.code}: ${redactSecrets(diagnostic.message)}`;
}

function redactSecrets(value: string): string {
	return value
		.replace(/figma[_-]?token\s*[:=]\s*[^\s]+/gi, "FIGMA_TOKEN=[redacted]")
		.replace(/bearer\s+[a-z0-9._-]+/gi, "Bearer [redacted]");
}
