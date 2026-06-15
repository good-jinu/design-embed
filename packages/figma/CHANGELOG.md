# @design-embed/figma

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
