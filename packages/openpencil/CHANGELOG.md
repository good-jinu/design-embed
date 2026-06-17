# @design-embed/openpencil

## 2.0.0

### Minor Changes

- fe9ec80: Add the `@design-embed/openpencil` source plugin.

  A local-file source plugin built on `@open-pencil/core`. It loads a `.fig` or `.pen` file, resolves the requested node, exports its assets (vector subtrees to SVG, image fills from the embedded bytes), and compiles it to HTML — no network access or token required. It reuses the HTML compiler and node types from `@design-embed/figma`, so both plugins emit the same normalized tree.

### Patch Changes

- Updated dependencies [53f9b59]
- Updated dependencies [53f9b59]
- Updated dependencies [538397e]
  - @design-embed/figma@2.0.0
  - design-embed@0.5.0
