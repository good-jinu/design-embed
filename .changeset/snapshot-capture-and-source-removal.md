---
"design-embed": minor
"@design-embed/figma": patch
---

Add design snapshot capture and remove deprecated `source` field.

Introduces `DesignSnapshotter` abstraction with two implementations:
`FigmaApiSnapshotter` (fetches a baseline PNG from the Figma REST API during `embed()`) and `HeadlessSnapshotter` (stub for test-time use in a future task). `resolveSnapshotter()` auto-detects the right implementation from `SnapshotConfig.mode` or the plugin name. Snapshot failures emit a `SNAPSHOT_FAILED` warning — output files are always written.

`FigmaHtmlPlugin.run()` now returns `meta: { fileId, nodeId, viewName }` for use by `FigmaApiSnapshotter`.

**Breaking:** The deprecated `source` field on `DesignEmbedConfig` is removed. Migrate to `sources: [{ plugin: yourPlugin }]`.
