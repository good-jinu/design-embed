import { runCompileCommand } from "./compile.ts";

export async function runCheckCommand(
	flags: Record<string, string | boolean>,
): Promise<number> {
	return runCompileCommand(flags, { check: true });
}
