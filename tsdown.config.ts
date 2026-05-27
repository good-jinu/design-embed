import path from "node:path";
import { defineConfig } from "tsdown";

const unbundledPackages = [
	"packages/config",
	"packages/core",
	"packages/target-react",
	"packages/plugin-figma-html",
];

export default defineConfig([
	// Packages that are published as-is: each .ts file transpiled 1:1
	...unbundledPackages.map((pkg) => ({
		entry: [`${pkg}/src/**/*.ts`],
		outDir: `${pkg}/dist`,
		format: "esm" as const,
		clean: true,
		dts: {
			eager: true,
		},
		unbundle: true,
		platform: "node" as const,
		exclude: [/\.test\.ts$/],
	})),

	// design-embed bundles its private workspace deps (@design-embed/config,
	// @design-embed/core) into dist so the published package is self-contained.
	// These are devDependencies so DepsPlugin won't externalize them;
	// the alias routes their imports directly to source files for rolldown.
	{
		entry: {
			index: "packages/design-embed/src/index.ts",
			cli: "packages/design-embed/src/cli.ts",
		},
		outDir: "packages/design-embed/dist",
		format: "esm" as const,
		clean: true,
		dts: {
			eager: true,
		},
		platform: "node" as const,
		alias: {
			"@design-embed/config": path.resolve("packages/config/src/index.ts"),
			"@design-embed/core": path.resolve("packages/core/src/index.ts"),
		},
	},
]);
