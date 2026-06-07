import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "../../e2e/fixtures",
	testMatch: "**/generated/tests/*.spec.ts",
	testIgnore: "**/generated/tests/*.visual.spec.ts",
	globalSetup: "./global-setup.ts",
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
