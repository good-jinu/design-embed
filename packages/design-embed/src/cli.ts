#!/usr/bin/env node
import { parseArgs } from "./args.ts";
import { runCheckCommand } from "./commands/check.ts";
import { runCompileCommand } from "./commands/compile.ts";
import { runGenerateTestsCommand } from "./commands/generateTests.ts";
import { runInitCommand } from "./commands/init.ts";
import { runPluginCommand } from "./commands/plugin.ts";

async function main(): Promise<number> {
	const args = process.argv.slice(2);
	const parsed = parseArgs(args);

	if (args[0] === "check") {
		return runCheckCommand(parsed.flags);
	}

	if (args[0] === "plugin") {
		return runPluginCommand(parsed.positionals[0], parsed.flags);
	}

	if (args[0] === "generate-tests") {
		return runGenerateTestsCommand(parsed.flags);
	}

	if (args[0] === "init") {
		return runInitCommand(parsed.flags);
	}

	const flags =
		args[0] && !args[0].startsWith("--")
			? { ...parsed.flags, "--": args[0] }
			: parsed.flags;
	return runCompileCommand(flags);
}

main()
	.then((code) => {
		if (code !== 0) {
			process.exit(code);
		}
	})
	.catch((error) => {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Pipeline failed: ${message}`);
		process.exit(1);
	});
