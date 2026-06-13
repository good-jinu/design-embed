---
"@design-embed/react": patch
"@design-embed/vue": patch
"@design-embed/vanjs": patch
---

Fix visual regression snapshot initialization failing on new platforms (e.g., Linux CI). The init branch now writes the baseline PNG directly via `writeFileSync` instead of calling `toHaveScreenshot`, which Playwright always fails when the snapshot file doesn't exist.
