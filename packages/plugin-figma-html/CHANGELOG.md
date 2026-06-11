# @design-embed/plugin-figma-html

## 2.0.0

### Minor Changes

- 87ba5c8: Enforce plugin architecture boundaries: targets now use design-embed types only, never runtime functions.

  - `embed()` now calls `unwrapDocument()` before passing nodes to any target adapter; targets receive body-ready content directly
  - `TargetTestGenerateInput` adds required `nodes` (post-mapping) and `sourceNodes` (pre-mapping) fields so targets no longer need to call `parseHtml`, `applyComponentMappings`, or `unwrapDocument` themselves
  - Remove `compileReact`, `compileVanjs`, `getCompiler`, `isCompilerMode`, `CompilerMode`, and `FigmaCompiler` from `@design-embed/plugin-figma-html`; framework code generation belongs in target packages, not source plugins

- e4d2977: feat(figma): support SVG exports for vector subtrees and CSS gradients

  - Add CSS gradient support (linear and radial) in Figma compiler
  - Add support for automatic SVG exports of vector-only subtrees in Figma plugin
  - Add decodeHtmlEntities to core HTML parser to handle escaped characters
  - Update test scripts in all packages to use quoted glob patterns

### Patch Changes

- Updated dependencies [87ba5c8]
- Updated dependencies [e7fb662]
- Updated dependencies [e4d2977]
  - design-embed@0.3.0

## 1.0.1

### Patch Changes

- cb6ea08: Fix package exports pointing to `dist/index.js` instead of the actual `dist/index.mjs` output from tsdown.
- Updated dependencies [cb6ea08]
  - design-embed@0.2.1

## 1.0.0

### Minor Changes

- b68082c: refactor(cli): simplify CLI interface and config loading

  - Simplify CLI and config structure
  - Remove --input flag; run fetch/compile directly
  - Remove deprecated plugin command

### Patch Changes

- Updated dependencies [dc5bfed]
- Updated dependencies [dc84718]
- Updated dependencies [5500814]
- Updated dependencies [d2261e1]
- Updated dependencies [7c4a304]
- Updated dependencies [b68082c]
  - design-embed@0.2.0
