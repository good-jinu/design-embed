import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./src/generated/views",
	testMatch: "**/tests/*.visual.spec.ts",
	globalSetup: "./global-setup.ts",
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
