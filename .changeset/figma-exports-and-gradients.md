---
"design-embed": patch
"@design-embed/plugin-figma-html": minor
"@design-embed/target-react": patch
"@design-embed/target-vanjs": patch
"@design-embed/target-vue": patch
---

feat(figma): support SVG exports for vector subtrees and CSS gradients

- Add CSS gradient support (linear and radial) in Figma compiler
- Add support for automatic SVG exports of vector-only subtrees in Figma plugin
- Add decodeHtmlEntities to core HTML parser to handle escaped characters
- Update test scripts in all packages to use quoted glob patterns
