# design-embed

## 0.5.0

### Minor Changes

- 53f9b59: Improve Figma → HTML layout fidelity and reduce diagnostic noise.

  - Map Figma "fill" sizing relative to the parent's main axis: filling the main axis becomes `flex-grow`, filling the cross axis becomes `align-self: stretch`. Previously every fill became `flex: 1`, which grew elements (especially text) on the wrong axis inside column layouts.
  - Stop emitting a fixed pixel size for axes that hug or fill, so flexbox can size them.
  - Grow non-clipping frames to their real content extent so background fills cover overflowing content instead of stopping at the frame's bounding box.
  - Emit `text-align` from Figma's `textAlignHorizontal` so centered/right-aligned text is no longer rendered left-aligned.
  - Collapse high-volume `info` diagnostics (e.g. `TOKEN_NO_MATCH`) into a per-code summary by default; pass `--verbose` to list them individually.

### Patch Changes

- 538397e: Fix `init` command generating config with incorrect types — `source` is now correctly placed inside `sources[]` and `viewName` moved into the source-level `output`.

## 0.4.0

### Minor Changes

- 7f65bd6: Add opt-in heuristic component auto-detection via the new `detect` config option (off by default).

  When enabled with `detect: true` (or `detect: { componentsDir, minOccurrences, minSubtreeSize }`), design-embed rewrites parsed HTML into component nodes without manual `components` mappings. It runs deterministically per source and (1) maps HTML to your existing hand-written components scanned from `componentsDir`, referencing them without re-generating their files, and (2) synthesizes new components from repeated structures, parameterizing the parts that vary across repeats as props (including nested slots). Manual `components` mappings always take precedence, and an existing-component match wins over synthesis. Configs without `detect` are unaffected.

- 0af3701: Refactor `embed()` to iterate over `config.sources` instead of a single `config.source`.

  Each source now runs independently through the full pipeline (plugin → AST → mappings → emit → tests). Files and diagnostics from all sources are collected together. A source that errors does not block remaining sources. The legacy `source` field continues to work via migration shim. `snapshotPath: null` placeholder is in place for the upcoming snapshot integration.

- 677c5b9: Add multi-source config schema and visual snapshot types.

  Introduces `sources` array, per-source `SourceConfig`, `SnapshotConfig`, and `resolveConfig()` with defaults. Adds `snapshotPath` to `TargetTestGenerateInput`. The old `source` field is deprecated with a runtime warning but continues to work.

- 941bf27: Add design snapshot capture and remove deprecated `source` field.

  Introduces `DesignSnapshotter` abstraction with two implementations:
  `FigmaApiSnapshotter` (fetches a baseline PNG from the Figma REST API during `embed()`) and `HeadlessSnapshotter` (stub for test-time use in a future task). `resolveSnapshotter()` auto-detects the right implementation from `SnapshotConfig.mode` or the plugin name. Snapshot failures emit a `SNAPSHOT_FAILED` warning — output files are always written.

  `FigmaHtmlPlugin.run()` now returns `meta: { fileId, nodeId, viewName }` for use by `FigmaApiSnapshotter`.

  **Breaking:** The deprecated `source` field on `DesignEmbedConfig` is removed. Migrate to `sources: [{ plugin: yourPlugin }]`.

- b91e55d: Rename `plugin` to `source` in `SourceConfig`; move `styleMode` into target constructors

  **Breaking changes:**

  - `SourceConfig.plugin` is renamed to `SourceConfig.source`. Update all config files:
    ```diff
    - sources: [{ plugin: fromFile("./design.html"), output: { viewName: "Hero" } }]
    + sources: [{ source: fromFile("./design.html"), output: { viewName: "Hero" } }]
    ```
  - `styleMode` is removed from `GlobalOutputConfig` and `SourceOutputConfig`. Pass it to the target constructor instead:
    ```diff
    - output: { target: new ReactTarget(), styleMode: "css-modules" }
    + output: { target: new ReactTarget({ styleMode: "css-modules" }) }
    ```
    `ReactTarget`, `VanJsTarget`, and `VueTarget` each accept `{ styleMode?: "inline" | "css-modules" | "tailwind" }` (default: `"inline"`).
  - `SourcePlugin.name` is now optional, so inline source objects no longer require a `name` field.

### Patch Changes

- 03d5e18: Update example URL to example.com
- 018f91a: Fix visual regression snapshot init to use component rendering instead of reference HTML.

  The snapshot baseline is now captured by mounting the component itself (via `mount()` in
  Playwright CT) rather than by calling `page.setContent(referenceHtml)`. This eliminates
  a systematic pixel-dimension mismatch that occurred because `page.setContent()` and the CT
  mount render in different browser contexts, causing consistent height differences that
  exceeded the `maxDiffPixels` threshold.

  Additional fixes:

  - `e2e/target-react.test.ts` now cleans the `generated/` directory before running `embed()`,
    preventing stale spec files from old code versions from persisting across runs.
  - `screenshotOptions.ts` `buildHeadlessBeforeAll` now prefixes source HTML with `<!DOCTYPE html>`
    so headless snapshot capture renders in Standards Mode (matching the test page context).

- e2c4471: instruction to use `npm exec design-embed`

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
