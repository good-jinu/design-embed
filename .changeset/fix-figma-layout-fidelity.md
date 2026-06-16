---
"@design-embed/figma": minor
"design-embed": minor
---

Improve Figma → HTML layout fidelity and reduce diagnostic noise.

- Map Figma "fill" sizing relative to the parent's main axis: filling the main axis becomes `flex-grow`, filling the cross axis becomes `align-self: stretch`. Previously every fill became `flex: 1`, which grew elements (especially text) on the wrong axis inside column layouts.
- Stop emitting a fixed pixel size for axes that hug or fill, so flexbox can size them.
- Grow non-clipping frames to their real content extent so background fills cover overflowing content instead of stopping at the frame's bounding box.
- Emit `text-align` from Figma's `textAlignHorizontal` so centered/right-aligned text is no longer rendered left-aligned.
- Collapse high-volume `info` diagnostics (e.g. `TOKEN_NO_MATCH`) into a per-code summary by default; pass `--verbose` to list them individually.
