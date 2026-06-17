# @design-embed/figma

## 2.0.0

### Minor Changes

- 53f9b59: Harden Figma network access against rate limits.

  - Asset downloads (image fills and SVG node exports) now run through a bounded concurrency pool instead of an unbounded `Promise.all`, so a design with many assets no longer fires a burst of simultaneous requests that triggers throttling or dropped connections. Defaults to 6 in flight; configurable via the new `concurrency` plugin option.
  - All Figma requests (API calls and asset downloads) now retry on `429` and transient `5xx` responses with exponential backoff, honoring the `Retry-After` header. Previously a single rate-limit response aborted the entire run. Configurable via the new `maxRetries` plugin option (default 3).

- 53f9b59: Improve Figma → HTML layout fidelity and reduce diagnostic noise.

  - Map Figma "fill" sizing relative to the parent's main axis: filling the main axis becomes `flex-grow`, filling the cross axis becomes `align-self: stretch`. Previously every fill became `flex: 1`, which grew elements (especially text) on the wrong axis inside column layouts.
  - Stop emitting a fixed pixel size for axes that hug or fill, so flexbox can size them.
  - Grow non-clipping frames to their real content extent so background fills cover overflowing content instead of stopping at the frame's bounding box.
  - Emit `text-align` from Figma's `textAlignHorizontal` so centered/right-aligned text is no longer rendered left-aligned.
  - Collapse high-volume `info` diagnostics (e.g. `TOKEN_NO_MATCH`) into a per-code summary by default; pass `--verbose` to list them individually.

### Patch Changes

- Updated dependencies [53f9b59]
- Updated dependencies [538397e]
  - design-embed@0.5.0

## 1.0.0

### Patch Changes

- 941bf27: Add design snapshot capture and remove deprecated `source` field.

  Introduces `DesignSnapshotter` abstraction with two implementations:
  `FigmaApiSnapshotter` (fetches a baseline PNG from the Figma REST API during `embed()`) and `HeadlessSnapshotter` (stub for test-time use in a future task). `resolveSnapshotter()` auto-detects the right implementation from `SnapshotConfig.mode` or the plugin name. Snapshot failures emit a `SNAPSHOT_FAILED` warning — output files are always written.

  `FigmaHtmlPlugin.run()` now returns `meta: { fileId, nodeId, viewName }` for use by `FigmaApiSnapshotter`.

  **Breaking:** The deprecated `source` field on `DesignEmbedConfig` is removed. Migrate to `sources: [{ plugin: yourPlugin }]`.

- Updated dependencies [7f65bd6]
- Updated dependencies [03d5e18]
- Updated dependencies [018f91a]
- Updated dependencies [e2c4471]
- Updated dependencies [0af3701]
- Updated dependencies [677c5b9]
- Updated dependencies [941bf27]
- Updated dependencies [b91e55d]
  - design-embed@0.4.0

## 0.2.0

### Minor Changes

- 1ed5bd9: Rename packages to @design-embed/<name> and update package directory structure to packages/<name>.
