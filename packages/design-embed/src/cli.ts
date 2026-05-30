#!/usr/bin/env node
import { parseArgs } from "./args.ts";
import { runCheckCommand } from "./commands/check.ts";
import { runCompileCommand } from "./commands/compile.ts";
import { runGenerateTestsCommand } from "./commands/generateTests.ts";
import { runInitCommand } from "./commands/init.ts";

async function main(): Promise<number> {
	const { command, flags } = parseArgs(process.argv.slice(2));

	if (command === "check") {
		return runCheckCommand(flags);
	}
	if (command === "generate-tests") {
		return runGenerateTestsCommand(flags);
	}
	if (command === "init") {
		return runInitCommand(flags);
	}

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
