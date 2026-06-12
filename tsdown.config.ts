import { defineConfig } from "tsdown";

const unbundledPackages = [
	"packages/react",
	"packages/vanjs",
	"packages/figma",
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

	// design-embed is published as a self-contained bundle. Its former private
	// workspace deps (config, core) now live in-tree under src/, so no aliases
	// are needed to route their imports.
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
	},
]);
