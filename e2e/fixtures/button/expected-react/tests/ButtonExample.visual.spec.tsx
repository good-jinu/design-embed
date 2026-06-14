import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { expect, test } from "@playwright/experimental-ct-react";
import { ButtonExample } from "../ButtonExample.view";

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
			test(`Visual Regression / ${state.name}`, async ({ mount }, testInfo) => {
				const snapshotName = `ButtonExample-${viewport.name ?? `${viewport.width}x${viewport.height}`}-${state.name}.png`;
				const snapshotPath = testInfo.snapshotPath(snapshotName);
				const component = await mount(<ButtonExample />);
				await applyState(component.page(), state);

				if (!existsSync(snapshotPath)) {
					mkdirSync(dirname(snapshotPath), { recursive: true });
					writeFileSync(snapshotPath, await component.screenshot());
					return;
				}

				await expect(component).toHaveScreenshot(snapshotName, { threshold: screenshotThreshold, maxDiffPixels: screenshotMaxDiffPixels });
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
