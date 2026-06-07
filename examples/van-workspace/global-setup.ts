import { execSync } from "node:child_process";
import { readdirSync, existsSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

export default async function globalSetup() {
	const viewsDir = resolve(import.meta.dirname, "src/generated/views");
	if (!existsSync(viewsDir)) return;

	const esbuild = resolve(import.meta.dirname, "node_modules/.bin/esbuild");

	for (const file of readdirSync(viewsDir)) {
		if (!file.endsWith(".mount.entry.ts")) continue;
		const name = file.replace(".mount.entry.ts", "");
		const entryPath = join(viewsDir, file);
		const bundlePath = join(viewsDir, `${name}.bundle.js`);
		const mountHtmlPath = join(viewsDir, `${name}.mount.html`);

		execSync(
			`${esbuild} ${entryPath} --bundle --format=iife --outfile=${bundlePath}`,
			{ stdio: "inherit" },
		);

		writeFileSync(
			mountHtmlPath,
			`<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8" /><script defer src="./${name}.bundle.js"></script></head>\n<body></body>\n</html>\n`,
		);
	}
}
