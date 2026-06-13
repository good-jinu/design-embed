import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/experimental-ct-react";
import { ButtonExample } from "../ButtonExample.view";

const currentDir = dirname(fileURLToPath(import.meta.url));
const referenceHtml = readFileSync(resolve(currentDir, "./ButtonExample.reference.html"), "utf-8");
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
				const snapshotName = `ButtonExample-${viewport.name ?? `${viewport.width}x${viewport.height}`}-${state.name}.png`;
				const snapshotPath = testInfo.snapshotPath(snapshotName);

				if (!existsSync(snapshotPath)) {
					testInfo.annotations.push({ type: "init", description: "Snapshot initialized from reference HTML" });
					await page.setContent(referenceHtml);
					await applyState(page, state);
					const locator = page.locator("body > *").first();
					mkdirSync(dirname(snapshotPath), { recursive: true });
					writeFileSync(snapshotPath, await locator.screenshot());
					return;
				}

				const component = await mount(<ButtonExample />);
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
	if (state.waitFor) await page.waitForSelector(state.waitFor);
	if (state.hover) await page.hover(state.hover);
	if (state.focus) await page.focus(state.focus);
	if (state.click) await page.click(state.click);
}
