import type { CompilerMode, FigmaCompiler } from "../types.ts";
import { compileHtml } from "./htmlCompiler.ts";
import { compileReact } from "./reactCompiler.ts";
import { compileVanjs } from "./vanjsCompiler.ts";

export { compileHtml, compileHtmlFragment } from "./htmlCompiler.ts";
export { compileReact } from "./reactCompiler.ts";
export { compileVanjs } from "./vanjsCompiler.ts";

export const compilers: Record<CompilerMode, FigmaCompiler> = {
	react: compileReact,
	html: compileHtml,
	vanjs: compileVanjs,
};

export function isCompilerMode(
	value: string | undefined,
): value is CompilerMode {
	return Boolean(value && value in compilers);
}

export function getCompiler(mode: CompilerMode): FigmaCompiler {
	return compilers[mode];
}
