import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Diagnostic } from "@design-embed/core";
import { getBooleanFlag, getFormat, getStringFlag } from "../args.ts";
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
		{
			path: "design.html",
			contents: designHtmlTemplate(),
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
		console.log(
			"Next: pnpm exec design-embed --input ./design.html --config ./design-embed.config.ts",
		);
	}
	return 0;
}

function configTemplate(viewName: string): string {
	return `import { defineConfig } from "design-embed";

export default defineConfig({
\toutput: {
\t\tviewName: "${viewName}",
\t\tviewsDir: "src/generated/views",
\t},
});
`;
}

function designHtmlTemplate(): string {
	return `<section style="box-sizing: border-box; width: 320px; padding: 24px; border-radius: 16px; background: #f8fafc; color: #0f172a; font-family: Arial, sans-serif;">
\t<p style="margin: 0 0 8px; color: #2563eb; font-size: 14px; font-weight: 700;">Design Embed</p>
\t<h1 style="margin: 0 0 12px; font-size: 32px; line-height: 1.1;">Welcome hero</h1>
\t<p style="margin: 0 0 20px; font-size: 16px; line-height: 1.5;">Replace this file with HTML exported from your design source.</p>
\t<button data-role="primary" style="border: 0; border-radius: 999px; padding: 12px 18px; background: #2563eb; color: white; font-size: 14px; font-weight: 700;">Get started</button>
</section>
`;
}
