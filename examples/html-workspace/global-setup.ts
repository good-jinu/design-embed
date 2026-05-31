import { execSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

export default async function globalSetup() {
	const fixturesDir = resolve(import.meta.dirname, "../../e2e/fixtures");
	const esbuild = resolve(import.meta.dirname, "node_modules/.bin/esbuild");

	for (const fixture of readdirSync(fixturesDir)) {
		const generatedDir = join(fixturesDir, fixture, "generated");
		if (!existsSync(generatedDir)) continue;

		for (const file of readdirSync(generatedDir)) {
			if (!file.endsWith(".ts")) continue;
			const tsPath = join(generatedDir, file);
			const jsPath = tsPath.replace(/\.ts$/, ".js");
			console.log(`  compile ${fixture}/${file}`);
			execSync(`${esbuild} ${tsPath} --outfile=${jsPath} --format=esm`, {
				stdio: "inherit",
			});
		}
	}
}
