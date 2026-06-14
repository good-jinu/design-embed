---
"design-embed": minor
"@design-embed/react": patch
"@design-embed/vue": patch
"@design-embed/vanjs": patch
---

Add multi-source config schema and visual snapshot types.

Introduces `sources` array, per-source `SourceConfig`, `SnapshotConfig`, and `resolveConfig()` with defaults. Adds `snapshotPath` to `TargetTestGenerateInput`. The old `source` field is deprecated with a runtime warning but continues to work.
