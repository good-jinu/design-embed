import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadConfig, type PluginDefinition } from "@design-embed/config";
import type { SourcePlugin } from "@design-embed/core";
import { getStringFlag } from "../args.ts";

export async function runPluginCommand(
	_name: string | undefined,
	flags: Record<string, string | boolean>,
): Promise<number> {
	const cwd = resolve(process.cwd(), getStringFlag(flags, "--cwd") ?? ".");
	const configPath =
		getStringFlag(flags, "--config") ?? "design-embed.config.ts";
	const configResult = await loadConfig(configPath, cwd);
	for (const diagnostic of configResult.diagnostics) {
		if (diagnostic.severity === "error") {
			console.error(`error: ${diagnostic.code}: ${diagnostic.message}`);
		} else {
			console.warn(
				`${diagnostic.severity}: ${diagnostic.code}: ${diagnostic.message}`,
			);
		}
	}
	if (configResult.diagnostics.some((d) => d.severity === "error")) {
		return 2;
	}

	const outPath = getStringFlag(flags, "--out");
	if (!outPath) {
		console.error("Error: --out is required.");
		return 2;
	}

	const plugin = findSourcePlugin(configResult.config?.plugins);
	if (!plugin) {
		console.error(
			"Error: config must include a source plugin instance in the plugins array (e.g. new FigmaHtmlPlugin({ ... })).",
		);
		return 2;
	}

	const result = await plugin.run({ cwd, args: {} });

	for (const diagnostic of result.diagnostics) {
		const output = `${diagnostic.severity}: ${diagnostic.code}: ${diagnostic.message}`;
		if (diagnostic.severity === "error") {
			console.error(output);
		} else {
			console.warn(output);
		}
	}

	if (result.diagnostics.some((d) => d.severity === "error")) {
		return 2;
	}

	if (!result.html) {
		console.error("Error: source plugin produced no HTML.");
		return 2;
	}

	const resolvedOutPath = resolve(cwd, outPath);
	mkdirSync(dirname(resolvedOutPath), { recursive: true });
	writeFileSync(resolvedOutPath, result.html, "utf-8");
	console.log(`Wrote ${outPath}`);

	for (const file of result.files ?? []) {
		const resolvedPath = resolve(cwd, file.path);
		mkdirSync(dirname(resolvedPath), { recursive: true });
		writeFileSync(resolvedPath, file.contents, "utf-8");
		console.log(`Wrote ${file.path}`);
	}

	return 0;
}

function isSourcePlugin(plugin: PluginDefinition): plugin is SourcePlugin {
	return typeof (plugin as SourcePlugin).run === "function";
}

function findSourcePlugin(
	plugins: PluginDefinition[] | undefined,
): SourcePlugin | undefined {
	return plugins?.find(isSourcePlugin);
}
