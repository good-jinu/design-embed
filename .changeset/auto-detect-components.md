---
"design-embed": minor
"@design-embed/react": minor
"@design-embed/vue": minor
"@design-embed/vanjs": minor
---

Add opt-in heuristic component auto-detection via the new `detect` config option (off by default).

When enabled with `detect: true` (or `detect: { componentsDir, minOccurrences, minSubtreeSize }`), design-embed rewrites parsed HTML into component nodes without manual `components` mappings. It runs deterministically per source and (1) maps HTML to your existing hand-written components scanned from `componentsDir`, referencing them without re-generating their files, and (2) synthesizes new components from repeated structures, parameterizing the parts that vary across repeats as props (including nested slots). Manual `components` mappings always take precedence, and an existing-component match wins over synthesis. Configs without `detect` are unaffected.
