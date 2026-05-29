import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getBooleanFlag, getFormat, getStringFlag } from "../args.ts";
import type { Diagnostic } from "../core/index.ts";
import { printDiagnostics } from "./compile.ts";

export async function runInitCommand(
	flags: Record<string, string | boolean>,
): Promise<number> {
	const cwd = resolve(process.cwd(), getStringFlag(flags, "--cwd") ?? ".");
	const quiet = getBooleanFlag(flags, "--quiet");
	const force = getBooleanFlag(flags, "--force");
	const format = getFormat(flags);
	const viewName = getStringFlag(flags, "--view-name") ?? "WelcomeHero";
	const diagnostics: Diagnostic[] = [];

	const files = [
		{
			path: "design-embed.config.ts",
			contents: configTemplate(viewName),
		},
	];

	let written = 0;
	for (const file of files) {
		const outPath = resolve(cwd, file.path);
		if (existsSync(outPath) && !force) {
			diagnostics.push({
				code: "INIT_FILE_EXISTS",
				message: `Skipped existing file: ${file.path}. Pass --force to overwrite it.`,
				severity: "warning",
				file: file.path,
			});
			continue;
		}
		mkdirSync(dirname(outPath), { recursive: true });
		writeFileSync(outPath, file.contents, "utf-8");
		written += 1;
		if (!quiet && format === "text") {
			console.log(`Wrote ${file.path}`);
		}
	}

	printDiagnostics(diagnostics, format, quiet);
	if (!quiet && format === "text") {
		console.log(`Success. Initialized design-embed with ${written} file(s).`);
		console.log("Next: pnpm exec design-embed --out ./design.html");
	}
	return 0;
}

function configTemplate(viewName: string): string {
	return `import {
\tdefineConfig,
\ttype PluginDefinition,
\ttype SourcePlugin,
\ttype SourcePluginInput,
\ttype SourcePluginResult,
} from "design-embed";

class HtmlFetcherPlugin implements PluginDefinition, SourcePlugin {
\treadonly name = "html-fetcher";
\tprivate readonly options: { url: string };

\tconstructor(options: { url: string }) {
\t\tthis.options = options;
\t}

\tasync run(_input: SourcePluginInput): Promise<SourcePluginResult> {
\t\ttry {
\t\t\tconst response = await fetch(this.options.url);
\t\t\tif (!response.ok) {
\t\t\t\treturn {
\t\t\t\t\tdiagnostics: [
\t\t\t\t\t\t{
\t\t\t\t\t\t\tcode: "HTML_FETCH_FAILED",
\t\t\t\t\t\t\tmessage: \`Failed to fetch HTML: \${response.status} \${response.statusText}\`,
\t\t\t\t\t\t\tseverity: "error",
\t\t\t\t\t\t},
\t\t\t\t\t],
\t\t\t\t};
\t\t\t}

\t\t\treturn {
\t\t\t\thtml: await response.text(),
\t\t\t\tdiagnostics: [],
\t\t\t};
\t\t} catch (error) {
\t\t\treturn {
\t\t\t\tdiagnostics: [
\t\t\t\t\t{
\t\t\t\t\t\tcode: "HTML_FETCH_FAILED",
\t\t\t\t\t\tmessage: error instanceof Error ? error.message : String(error),
\t\t\t\t\t\tseverity: "error",
\t\t\t\t\t},
\t\t\t\t],
\t\t\t};
\t\t}
\t}
}

export default defineConfig({
\tplugins: [
\t\tnew HtmlFetcherPlugin({
\t\t\turl: "https://www.scrapethissite.com/pages/",
\t\t}),
\t],
\toutput: {
\t\tviewName: "${viewName}",
\t\tviewsDir: "src/generated/views",
\t},
});
`;
}
