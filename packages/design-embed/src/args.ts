export interface ParsedArgs {
	command: string;
	flags: Record<string, string | boolean>;
}

export function parseArgs(args: string[]): ParsedArgs {
	const positionals: string[] = [];
	const flags: Record<string, string | boolean> = {};

	for (let index = 0; index < args.length; index += 1) {
		const value = args[index];
		if (!value?.startsWith("--")) {
			if (value) {
				positionals.push(value);
			}
			continue;
		}

		const next = args[index + 1];
		if (!next || next.startsWith("--")) {
			flags[value] = true;
			continue;
		}

		flags[value] = next;
		index += 1;
	}

	const [command = "compile"] = positionals;
	return { command, flags };
}

export function getStringFlag(
	flags: Record<string, string | boolean>,
	name: string,
): string | undefined {
	const value = flags[name];
	return typeof value === "string" ? value : undefined;
}

export function getBooleanFlag(
	flags: Record<string, string | boolean>,
	name: string,
): boolean {
	return flags[name] === true;
}

export function getFormat(
	flags: Record<string, string | boolean>,
): "json" | "text" {
	return flags["--format"] === "json" ? "json" : "text";
}
