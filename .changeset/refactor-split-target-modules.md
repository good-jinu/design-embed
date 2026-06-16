---
"@design-embed/react": patch
"@design-embed/vue": patch
"@design-embed/vanjs": patch
---

Refactor: split monolithic `index.ts` into focused modules (`utils`, `styles`, `nodes`, `emit`, `generateTests`, `target`) in the react, vue, and vanjs packages. No behaviour change.
