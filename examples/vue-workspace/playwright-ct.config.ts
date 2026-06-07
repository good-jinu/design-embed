import { defineConfig, devices } from "@playwright/experimental-ct-vue";

export default defineConfig({
	testDir: "../../e2e/fixtures",
	testMatch: "**/generated/tests/*.visual.spec.ts",
	snapshotDir: "./__snapshots__",
	use: {
		ctPort: 3100,
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
