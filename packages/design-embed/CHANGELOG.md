# design-embed

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
