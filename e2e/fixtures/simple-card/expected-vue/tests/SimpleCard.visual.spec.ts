import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/experimental-ct-vue";
import SimpleCard from "../SimpleCard.vue";

const currentDir = dirname(fileURLToPath(import.meta.url));
const referenceHtml = readFileSync(resolve(currentDir, "./SimpleCard.reference.html"), "utf-8");
const viewports = [
  {
    "name": "default",
    "width": 1440,
    "height": 900
  }
];
const states = [
  {
    "name": "default"
  }
];
const screenshotThreshold = 0.2;
const screenshotMaxDiffPixels = 500;

for (const viewport of viewports) {
	test.describe(`${viewport.name ?? `${viewport.width}x${viewport.height}`}`, () => {
		test.use({ viewport: { width: viewport.width, height: viewport.height } });
		for (const state of states) {
			test(`Visual Regression / ${state.name}`, async ({ page, mount }, testInfo) => {
				const snapshotName = `SimpleCard-${viewport.name ?? `${viewport.width}x${viewport.height}`}-${state.name}.png`;
				const snapshotPath = testInfo.snapshotPath(snapshotName);

				if (!existsSync(snapshotPath)) {
					testInfo.annotations.push({ type: "init", description: "Snapshot initialized from reference HTML" });
					await page.setContent(referenceHtml);
					await applyState(page, state);
					const locator = page.locator("body > *").first();
					await expect(locator).toHaveScreenshot(snapshotName, {
						threshold: screenshotThreshold,
						maxDiffPixels: screenshotMaxDiffPixels,
					});
					return;
				}

				const component = await mount(SimpleCard);
				await applyState(component.page(), state);
				await expect(component).toHaveScreenshot(snapshotName, {
					threshold: screenshotThreshold,
					maxDiffPixels: screenshotMaxDiffPixels,
				});
			});
		}
	});
}

async function applyState(page, state) {
	if (state.waitFor) {
		await page.waitForSelector(state.waitFor);
	}
	if (state.hover) {
		await page.hover(state.hover);
	}
	if (state.focus) {
		await page.focus(state.focus);
	}
	if (state.click) {
		await page.click(state.click);
	}
}
