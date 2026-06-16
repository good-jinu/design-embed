---
"@design-embed/figma": minor
---

Harden Figma network access against rate limits.

- Asset downloads (image fills and SVG node exports) now run through a bounded concurrency pool instead of an unbounded `Promise.all`, so a design with many assets no longer fires a burst of simultaneous requests that triggers throttling or dropped connections. Defaults to 6 in flight; configurable via the new `concurrency` plugin option.
- All Figma requests (API calls and asset downloads) now retry on `429` and transient `5xx` responses with exponential backoff, honoring the `Retry-After` header. Previously a single rate-limit response aborted the entire run. Configurable via the new `maxRetries` plugin option (default 3).
