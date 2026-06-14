---
"@design-embed/react": patch
"@design-embed/vue": patch
"@design-embed/vanjs": patch
"design-embed": patch
---

Fix visual regression snapshot init to use component rendering instead of reference HTML.

The snapshot baseline is now captured by mounting the component itself (via `mount()` in
Playwright CT) rather than by calling `page.setContent(referenceHtml)`. This eliminates
a systematic pixel-dimension mismatch that occurred because `page.setContent()` and the CT
mount render in different browser contexts, causing consistent height differences that
exceeded the `maxDiffPixels` threshold.

Additional fixes:
- `e2e/target-react.test.ts` now cleans the `generated/` directory before running `embed()`,
  preventing stale spec files from old code versions from persisting across runs.
- `screenshotOptions.ts` `buildHeadlessBeforeAll` now prefixes source HTML with `<!DOCTYPE html>`
  so headless snapshot capture renders in Standards Mode (matching the test page context).
