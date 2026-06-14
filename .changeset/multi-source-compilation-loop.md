---
"design-embed": minor
---

Refactor `embed()` to iterate over `config.sources` instead of a single `config.source`.

Each source now runs independently through the full pipeline (plugin → AST → mappings → emit → tests). Files and diagnostics from all sources are collected together. A source that errors does not block remaining sources. The legacy `source` field continues to work via migration shim. `snapshotPath: null` placeholder is in place for the upcoming snapshot integration.
