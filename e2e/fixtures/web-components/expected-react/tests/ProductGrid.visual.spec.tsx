import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/experimental-ct-react";
import { ProductGrid } from "../ProductGrid.view";

const currentDir = dirname(fileURLToPath(import.meta.url));
const referenceHtml = readFileSync(resolve(currentDir, "./ProductList.reference.html"), "utf-8");
const selector = ".product-grid";
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

for (const viewport of viewports) {
	for (const state of states) {
		const viewportName = viewport.name ?? String(viewport.width) + "x" + String(viewport.height);
		test("ProductGrid matches source at " + viewportName + " / " + state.name, async ({ mount, page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });

			await page.setContent(referenceHtml);
			await applyState(page, state);
			const expectedEl = page.locator(selector).first();
			const expectedScreenshot = screenshotEnabled ? await expectedEl.screenshot() : undefined;
			const expectedLayout = layoutEnabled ? await readLayout(expectedEl, selectors) : [];

			const component = await mount(<ProductGrid />);
			await applyState(page, state);
			const actualScreenshot = screenshotEnabled ? await component.screenshot() : undefined;
			const actualLayout = layoutEnabled ? await readLayout(component, selectors) : [];

			if (screenshotEnabled) {
				expect(actualScreenshot).toEqual(expectedScreenshot);
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
