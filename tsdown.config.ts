import { defineConfig } from "tsdown";

const packages = [
	"packages/config",
	"packages/core",
	"packages/target-react",
	"packages/plugin-figma-html",
	"packages/design-embed",
];

export default defineConfig(
	packages.map((pkg) => ({
		entry: [`${pkg}/src/**/*.ts`],
		output: {
			dir: `${pkg}/dist`,
			format: "esm" as const,
		},
		clean: true,
		dts: {
			eager: true,
		},
		unbundle: true,
		platform: "node" as const,
		exclude: [/\.test\.ts$/],
	})),
);
