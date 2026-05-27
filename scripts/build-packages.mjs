import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import ts from "typescript";

const packageDirs = [
	"packages/config",
	"packages/core",
	"packages/target-react",
	"packages/plugin-figma-html",
	"packages/design-embed",
];

for (const packageDir of packageDirs) {
	const srcDir = join(packageDir, "src");
	const distDir = join(packageDir, "dist");
	rmSync(distDir, { recursive: true, force: true });
	emitDirectory(srcDir, srcDir, distDir);
}

function emitDirectory(rootDir, currentDir, distDir) {
	for (const entry of readdirSync(currentDir)) {
		const sourcePath = join(currentDir, entry);
		const stats = statSync(sourcePath);
		if (stats.isDirectory()) {
			emitDirectory(rootDir, sourcePath, distDir);
			continue;
		}
		if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) {
			continue;
		}

		const relativePath = relative(rootDir, sourcePath);
		const outPath = join(distDir, relativePath).replace(/\.ts$/, ".js");
		const source = readFileSync(sourcePath, "utf8");
		const output = ts.transpileModule(source, {
			fileName: sourcePath,
			compilerOptions: {
				target: ts.ScriptTarget.ES2024,
				module: ts.ModuleKind.ES2022,
				moduleResolution: ts.ModuleResolutionKind.Bundler,
				verbatimModuleSyntax: true,
			},
		}).outputText;

		mkdirSync(dirname(outPath), { recursive: true });
		writeFileSync(outPath, rewriteRelativeTsExtensions(output), "utf8");
	}
}

function rewriteRelativeTsExtensions(output) {
	return output.replace(
		/((?:from|import)\s*\(?\s*["'])(\.[^"']+)\.ts(["'])/g,
		"$1$2.js$3",
	);
}
