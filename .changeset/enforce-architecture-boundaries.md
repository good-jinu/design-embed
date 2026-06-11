---
"design-embed": minor
"@design-embed/plugin-figma-html": minor
"@design-embed/target-react": patch
"@design-embed/target-vue": patch
"@design-embed/target-vanjs": patch
---

Enforce plugin architecture boundaries: targets now use design-embed types only, never runtime functions.

- `embed()` now calls `unwrapDocument()` before passing nodes to any target adapter; targets receive body-ready content directly
- `TargetTestGenerateInput` adds required `nodes` (post-mapping) and `sourceNodes` (pre-mapping) fields so targets no longer need to call `parseHtml`, `applyComponentMappings`, or `unwrapDocument` themselves
- Remove `compileReact`, `compileVanjs`, `getCompiler`, `isCompilerMode`, `CompilerMode`, and `FigmaCompiler` from `@design-embed/plugin-figma-html`; framework code generation belongs in target packages, not source plugins
