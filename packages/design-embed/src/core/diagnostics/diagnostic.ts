import type { SourceLocation } from "../index.ts";

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
	code: string;
	message: string;
	severity: DiagnosticSeverity;
	file?: string;
	source?: SourceLocation;
	selector?: string;
	property?: string;
	details?: Record<string, unknown>;
}

export function hasErrorDiagnostics(diagnostics: Diagnostic[]): boolean {
	return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
