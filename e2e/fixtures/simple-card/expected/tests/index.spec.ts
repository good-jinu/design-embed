import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const referenceHtml = readFileSync(resolve(currentDir, "./index.reference.html"), "utf-8");
const outputHtmlPath = resolve(currentDir, "../index.html");
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
const selectors = [
  ":scope",
  ":scope *"
];
const screenshotEnabled = true;
const layoutEnabled = true;
const layoutTolerance = 0;
const screenshotThreshold = 0.2;
const screenshotMaxDiffPixels = 500;

for (const viewport of viewports) {
	for (const state of states) {
		const viewportName = viewport.name ?? String(viewport.width) + "x" + String(viewport.height);
		test("index matches source at " + viewportName + " / " + state.name, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });

			await page.setContent(referenceHtml);
			await applyState(page, state);
			const expectedScreenshot = screenshotEnabled ? await page.screenshot({ fullPage: true }) : undefined;
			const expectedLayout = layoutEnabled ? await readLayout(page.locator("body > *").first(), selectors) : [];

			await page.goto("file://" + outputHtmlPath);
			await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
			await applyState(page, state);
			const actualScreenshot = screenshotEnabled ? await page.screenshot({ fullPage: true }) : undefined;
			const actualLayout = layoutEnabled ? await readLayout(page.locator("body > *").first(), selectors) : [];

			if (screenshotEnabled) {
				const expectedPng = PNG.sync.read(expectedScreenshot);
				const actualPng = PNG.sync.read(actualScreenshot);
				expect(actualPng.width, "screenshot width").toBe(expectedPng.width);
				expect(actualPng.height, "screenshot height").toBe(expectedPng.height);
				const diff = new PNG({ width: expectedPng.width, height: expectedPng.height });
				const diffPixelCount = pixelmatch(expectedPng.data, actualPng.data, diff.data, expectedPng.width, expectedPng.height, { threshold: screenshotThreshold });
				expect(diffPixelCount, "screenshot diff pixels").toBeLessThanOrEqual(screenshotMaxDiffPixels);
			}
			if (layoutEnabled) {
				expectLayoutToMatch(actualLayout, expectedLayout, layoutTolerance);
			}
		});
	}
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

async function readLayout(root, selectorsToRead) {
	return root.evaluate((element, values) => {
		return values.flatMap((selector) => {
			const matches = selector === ":scope" ? [element] : Array.from(element.querySelectorAll(selector));
			return matches.map((matchedElement, index) => {
				const rect = matchedElement.getBoundingClientRect();
				return {
					selector,
					index,
					tagName: matchedElement.tagName.toLowerCase(),
					x: rect.x,
					y: rect.y,
					width: rect.width,
					height: rect.height,
				};
			});
		});
	}, selectorsToRead);
}

function expectLayoutToMatch(actual, expected, tolerance) {
	expect(actual.length).toBe(expected.length);
	for (let index = 0; index < expected.length; index += 1) {
		const actualRect = actual[index];
		const expectedRect = expected[index];
		expect(actualRect.selector).toBe(expectedRect.selector);
		expect(actualRect.index).toBe(expectedRect.index);
		expect(actualRect.tagName).toBe(expectedRect.tagName);
		for (const key of ["x", "y", "width", "height"]) {
			const drift = Math.abs(actualRect[key] - expectedRect[key]);
			expect(drift, `${expectedRect.selector}[${expectedRect.index}] ${key} drift`).toBeLessThanOrEqual(tolerance);
		}
	}
}
