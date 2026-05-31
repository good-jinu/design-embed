import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/experimental-ct-react";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { ProductFilter } from "../ProductFilter.view";

const currentDir = dirname(fileURLToPath(import.meta.url));
const referenceHtml = readFileSync(resolve(currentDir, "./ProductList.reference.html"), "utf-8");
const selector = ".filter-section";
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
const screenshotEnabled = false;
const layoutEnabled = false;
const layoutTolerance = 1;
const screenshotThreshold = 0.2;
const screenshotMaxDiffPixels = 500;

for (const viewport of viewports) {
	for (const state of states) {
		const viewportName = viewport.name ?? String(viewport.width) + "x" + String(viewport.height);
		test("ProductFilter matches source at " + viewportName + " / " + state.name, async ({ mount, page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });

			await page.setContent(referenceHtml);
			const isolatedHtml = await page.locator(selector).first().evaluate((node) => node.outerHTML);
			await page.setContent(isolatedHtml);
			await applyState(page, state);
			const expectedEl = page.locator(selector).first();
			const expectedScreenshot = screenshotEnabled ? await expectedEl.screenshot() : undefined;
			const expectedLayout = layoutEnabled ? await readLayout(expectedEl, selectors) : [];

			const component = await mount(<ProductFilter />);
			await applyState(page, state);
			const actualScreenshot = screenshotEnabled ? await component.screenshot() : undefined;
			const actualLayout = layoutEnabled ? await readLayout(component, selectors) : [];

			if (screenshotEnabled) {
				compareScreenshots(actualScreenshot, expectedScreenshot, screenshotThreshold, screenshotMaxDiffPixels);
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
		const origin = element.getBoundingClientRect();
		return values.flatMap((selector) => {
			const matches = selector === ":scope" ? [element] : Array.from(element.querySelectorAll(selector));
			return matches.map((matchedElement, index) => {
				const rect = matchedElement.getBoundingClientRect();
				return {
					selector,
					index,
					tagName: matchedElement.tagName.toLowerCase(),
					x: rect.x - origin.x,
					y: rect.y - origin.y,
					width: rect.width,
					height: rect.height,
				};
			});
		});
	}, selectorsToRead);
}

function compareScreenshots(actual, expected, threshold, maxDiffPixels) {
	if (!actual || !expected) {
		expect(actual).toEqual(expected);
		return;
	}
	const actualPng = PNG.sync.read(actual);
	const expectedPng = PNG.sync.read(expected);
	expect(actualPng.width, "screenshot width").toBe(expectedPng.width);
	expect(actualPng.height, "screenshot height").toBe(expectedPng.height);
	const diffPixels = pixelmatch(actualPng.data, expectedPng.data, null, actualPng.width, actualPng.height, { threshold });
	expect(diffPixels, "screenshot pixels differing beyond threshold").toBeLessThanOrEqual(maxDiffPixels);
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
