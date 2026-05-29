import { resolve } from "node:path";
import type { Diagnostic } from "../diagnostics/diagnostic.ts";
import type { GeneratedFile } from "../index.ts";

export interface CheckModeInput {
	files: GeneratedFile[];
	cwd: string;
	readFile(path: string): string | undefined;
}

export interface CheckModeResult {
	ok: boolean;
	diagnostics: Diagnostic[];
}

export function checkGeneratedFiles(input: CheckModeInput): CheckModeResult {
	const diagnostics: Diagnostic[] = [];

	for (const file of input.files) {
		const absolutePath = resolve(input.cwd, file.path);
		const current = input.readFile(absolutePath);
		if (current === undefined) {
			diagnostics.push({
				code: "CHECK_FILE_MISSING",
				message: `Generated file is missing: ${file.path}`,
				severity: "error",
				file: file.path,
			});
			continue;
		}

		if (current !== file.contents) {
			diagnostics.push({
				code: "CHECK_FILE_STALE",
				message: `Generated file is stale: ${file.path}`,
				severity: "error",
				file: file.path,
			});
		}
	}

	return {
		ok: diagnostics.length === 0,
		diagnostics,
	};
}
