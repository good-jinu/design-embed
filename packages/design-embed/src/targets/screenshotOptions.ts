import { basename } from "node:path";

/**
 * Builds the `toHaveScreenshot(...)` call string for a generated Playwright test.
 *
 * - Non-null path: uses the external baseline PNG (e.g. Figma API snapshot).
 * - Null path: delegates entirely to Playwright (`toHaveScreenshot()`).
 */
export function buildScreenshotAssertion(
	snapshotPath: string | null,
	threshold: number,
	maxDiffPixels: number,
	assertionTarget = "locator",
): string {
	if (snapshotPath !== null) {
		const name = JSON.stringify(basename(snapshotPath));
		return `await expect(${assertionTarget}).toHaveScreenshot({ name: ${name}, threshold: ${JSON.stringify(threshold)}, maxDiffPixels: ${JSON.stringify(maxDiffPixels)} });`;
	}
	return `await expect(${assertionTarget}).toHaveScreenshot();`;
}

/**
 * Builds a `test.beforeAll` block that captures the source HTML as a baseline
 * PNG when `UPDATE_SNAPSHOTS=1` is set. Used for headless snapshot mode where
 * capture happens at test-time rather than during `embed()`.
 */
export function buildHeadlessBeforeAll(
	sourceHtml: string,
	snapshotFilePath: string,
): string {
	return `// Baseline for headless snapshot: captured on first run or with UPDATE_SNAPSHOTS=1.
// Run: UPDATE_SNAPSHOTS=1 npx playwright test to refresh.
test.beforeAll(async ({ browser }) => {
\tif (process.env.UPDATE_SNAPSHOTS) {
\t\tconst page = await browser.newPage();
\t\tawait page.setContent(${JSON.stringify(sourceHtml)});
\t\tawait page.screenshot({ path: ${JSON.stringify(snapshotFilePath)} });
\t\tawait page.close();
\t}
});`;
}
