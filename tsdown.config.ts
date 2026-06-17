import { defineConfig } from "tsdown";

const unbundledPackages = [
	"packages/react",
	"packages/vanjs",
	"packages/figma",
	"packages/openpencil",
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
		// These packages are published as-is and resolve their dependencies at
		// runtime via node_modules. The root config can't see each package's own
		// dependencies, so externalize workspace and npm deps explicitly to keep
		// them as bare imports instead of bundling them into dist.
		deps: {
			neverBundle: [/^@design-embed\//, /^@open-pencil\//],
		},
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
