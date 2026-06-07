---
"@design-embed/plugin-figma-html": patch
"@design-embed/target-react": patch
"@design-embed/target-vanjs": patch
"@design-embed/target-vue": patch
---

Fix package exports pointing to `dist/index.js` instead of the actual `dist/index.mjs` output from tsdown.
