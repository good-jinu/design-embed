# design-embed

## 0.3.0

### Minor Changes

- 87ba5c8: Enforce plugin architecture boundaries: targets now use design-embed types only, never runtime functions.

  - `embed()` now calls `unwrapDocument()` before passing nodes to any target adapter; targets receive body-ready content directly
  - `TargetTestGenerateInput` adds required `nodes` (post-mapping) and `sourceNodes` (pre-mapping) fields so targets no longer need to call `parseHtml`, `applyComponentMappings`, or `unwrapDocument` themselves
  - Remove `compileReact`, `compileVanjs`, `getCompiler`, `isCompilerMode`, `CompilerMode`, and `FigmaCompiler` from `@design-embed/figma`; framework code generation belongs in target packages, not source plugins

- e7fb662: Add token auto-extraction, Tailwind scale, and layout group skip

### Patch Changes

- e4d2977: feat(figma): support SVG exports for vector subtrees and CSS gradients

  - Add CSS gradient support (linear and radial) in Figma compiler
  - Add support for automatic SVG exports of vector-only subtrees in Figma plugin
  - Add decodeHtmlEntities to core HTML parser to handle escaped characters
  - Update test scripts in all packages to use quoted glob patterns

## 0.2.2

### Patch Changes

- ac1793b: Update core logic and target implementations

## 0.2.1

### Patch Changes

- cb6ea08: Fix HTML parser dropping `<!DOCTYPE ...>` and other `<!...>` declarations instead of skipping them cleanly.

## 0.2.0

### Minor Changes

- dc5bfed: add web component output for HTML target and refactor target classes
- 5500814: Simplify component mappings and add per-component visual tests
- d2261e1: Clean up public API surface and remove dead code
- b68082c: refactor(cli): simplify CLI interface and config loading

  - Simplify CLI and config structure
  - Remove --input flag; run fetch/compile directly
  - Remove deprecated plugin command

### Patch Changes

- dc84718: Simplify embed API and consolidate pipeline
- 7c4a304: Replace byte-exact screenshot comparison with pixelmatch tolerance

## 0.1.1

### Patch Changes

- 4c8370b: Remove transformer plugin support
- Updated dependencies [4c8370b]
  - @design-embed/config@0.1.1
  - @design-embed/core@0.1.1
