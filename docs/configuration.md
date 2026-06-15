---
sidebar_position: 3
---

# Configuration Reference

The `design-embed.config.ts` file is the heart of the embedding process. It defines the mapping rules between your design artifacts and your production codebase.

## `defineConfig`

Using the `defineConfig` helper provides full TypeScript autocompletion:

```typescript
import { defineConfig } from "design-embed";

export default defineConfig({
  // ... your config
});
```

---

## Sources

The `sources` array is the only required field. Each entry defines one design input along with optional per-source overrides for output, components, tokens, and tests.

```typescript
import { defineConfig, fromFile } from "design-embed";
import { FigmaHtmlPlugin } from "@design-embed/figma";
import { ReactTarget } from "@design-embed/react";

export default defineConfig({
  // Global defaults — inherited by every source
  output: {
    target: new ReactTarget(),
    viewsDir: "src/generated/views",
    styleMode: "inline",
  },

  // One or more design sources
  sources: [
    {
      // Built-in helper: load HTML (and optional CSS) from a local file
      plugin: fromFile(new URL("./design/hero.html", import.meta.url)),
      output: { viewName: "Hero" },
    },
    {
      // Figma source: fetches a frame at compile time
      plugin: new FigmaHtmlPlugin({
        url: "https://www.figma.com/file/KEY/NAME?node-id=ID",
      }),
      output: { viewName: "Navbar" },
    },
  ],
});
```

Each source inherits global `output`, `components`, `tokens`, `styleMappings`, and `tests` settings. Per-source values override the global ones.

### `fromFile()`

A built-in convenience helper that creates a source plugin from a local HTML file (with an optional companion CSS file):

```typescript
import { fromFile } from "design-embed";

// HTML only
plugin: fromFile("./design/button.html")

// HTML + CSS
plugin: fromFile("./design/button.html", "./design/button.css")

// Using import.meta.url for reliable resolution
plugin: fromFile(new URL("./design/button.html", import.meta.url))
```

---

## Output Options

The `output` section sets global defaults for how and where files are generated. Per-source `output` overrides these per source.

```typescript
import { ReactTarget } from "@design-embed/react";

output: {
  target: new ReactTarget(),   // Omit for built-in HTML output
  viewsDir: "src/generated",   // Directory for output files
  styleMode: "tailwind"        // "inline", "tailwind", or "css-modules"
}
```

Set `viewName` per source via `sources[n].output.viewName` — each source generates its own view file.

```typescript
sources: [
  { plugin: ..., output: { viewName: "Hero" } },
  { plugin: ..., output: { viewName: "Footer" } },
]
```

### HtmlTarget options

When no target is specified, the built-in `HtmlTarget` is used. You can also configure it explicitly:

```typescript
import { HtmlTarget } from "design-embed";

// Light DOM output (default) — same as omitting the target entirely
target: new HtmlTarget()

// Shadow DOM output
target: new HtmlTarget({ domModel: "shadow" })

// Shorthand string — equivalent to new HtmlTarget()
target: "html"
```

When `components` are configured alongside an HTML target, two additional files are generated for each view:

- `ViewName.ts` — a native web component scaffold (`HTMLElement` subclass with `observedAttributes`, lifecycle hooks, and a `render()` method; no React dependency)
- `ViewName.html` — includes `<script defer src="./ViewName.js"></script>` at the bottom

---

## Component Mappings

This is where you tell the compiler to replace specific HTML elements with your actual project components.

```typescript
components: [
  {
    selector: "button[data-role='primary']",
    component: "Button",
    props: {
      variant: "primary",
      children: "$text"
    }
  }
]
```

- **`selector`**: A CSS selector to match nodes in the design HTML.
- **`component`**: The component name (e.g. `"Button"`). design-embed generates a `Button.view.tsx` file in the output directory and the main view imports from it automatically.
- **`props`**: A mapping of component props to values extracted from the HTML:
  - `"$text"`: The inner text of the element.
  - `"$children"`: The inner HTML elements.
  - `"$attr.name"`: The value of an attribute, such as `"$attr.src"`.

---

## Auto-Detecting Components

Instead of (or in addition to) writing `components` mappings by hand, you can let
design-embed detect components for you. Auto-detection is **off by default** —
enable it with the `detect` option:

```typescript
export default defineConfig({
  sources: [/* … */],
  output: { target: new ReactTarget(), viewsDir: "src/generated/views" },

  detect: true, // enable with defaults
});
```

Pass an object to tune it:

```typescript
detect: {
  componentsDir: "src/components", // scanned for your existing components (default)
  minOccurrences: 3,               // repeats needed before a structure is extracted (default)
  minSubtreeSize: 2,               // smallest subtree (nodes) worth extracting (default)
}
```

Detection runs heuristically and deterministically on every build, per source,
and does two things:

- **Map to existing components** — scans `componentsDir` and rewrites HTML that
  corresponds to your hand-written components into imports of them (by tag,
  class, or `data-component` name). These are referenced, never re-generated.
- **Synthesize new components** — extracts repeated structures into generated
  components. Values that vary across repeats (text, attributes) become props;
  identical parts are baked in.

Precedence is predictable:

- Manual `components` mappings always win — auto-detection only touches elements
  they didn't match. Existing configs that omit `detect` behave exactly as before.
- An existing-component match wins over synthesizing a new one.
- `detect` can be set globally and overridden per source; a source-level `false`
  disables it for that source even when it is enabled globally.

> Synthesis is conservative by design: if repeats differ in a way that can't be
> expressed deterministically (e.g. their inline styles diverge), that group is
> left inline rather than emitting incorrect output.

---

## Design Tokens

Tokens allow you to "snap" raw design values (like `15.98px`) to your project's defined scales (like `16px`).

```typescript
tokens: {
  spacing: {
    unit: "px",
    threshold: 2, // Snap values within 2px of a token
    values: {
      "4": 16,
      "8": 32
    }
  },
  colors: {
    "brand-blue": "#3B82F6"
  },
  colorThreshold: 5 // CIE76 color distance threshold
}
```

---

## Style Mappings

Required for `styleMode: "tailwind"`. It maps property/token combinations to specific utility classes.

```typescript
styleMappings: {
  spacing: {
    "padding:spacing.4": "p-4",
    "margin-top:spacing.8": "mt-8"
  },
  colors: {
    "background-color:colors.brand-blue": "bg-brand-primary"
  },
  radius: {
    "border-radius:radius.lg": "rounded-lg"
  }
}
```

---

## Snapshot

Each source can capture a baseline image of the original design alongside the generated files. Snapshots are used by generated visual tests as the reference image.

```typescript
sources: [{
  plugin: new FigmaHtmlPlugin({ url: "..." }),
  output: { viewName: "Hero" },
  snapshot: {
    mode: "figma-api",   // "figma-api" | "headless" | "none" (default)
    dir: "src/generated/views/__snapshots__",  // default: __snapshots__ next to viewsDir
    format: "png",       // "png" | "jpeg" (default: "png")
    scale: 2,            // pixel density (default: 1)
  },
}],
```

- **`mode: "figma-api"`** — Downloads the rendered image directly from the Figma API. Requires `FIGMA_TOKEN`. Only works with `FigmaHtmlPlugin`.
- **`mode: "headless"`** — Renders the source HTML in a headless browser and screenshots it. Works with any source plugin.
- **`mode: "none"`** — No snapshot is captured (default). Tests fall back to using the reference HTML fixture as the baseline.

---

## Test Generation

The `tests` section controls generated visual regression tests. React target emits Playwright component-test code that compares each generated React component against the source HTML at configured viewport sizes and interaction states.

```typescript
tests: {
  outputDir: "tests/generated/design-embed",
  runner: "playwright",
  viewports: [
    { name: "mobile", width: 390, height: 844 },
    { name: "desktop", width: 1440, height: 900 }
  ],
  states: [
    { name: "default" },
    { name: "cta-hover", hover: "button[data-role='primary']" }
  ],
  assertions: {
    screenshot: true,
    layout: true,
    layoutTolerance: 1,
    selectors: [":scope", ":scope *"]
  }
}
```

Run the generator with:

```bash npm2yarn
npm exec design-embed -- generate-tests
```

### What gets generated

For a view `WelcomeHero` with a `Button` component mapping:

```text
tests/generated/design-embed/
  WelcomeHero.reference.html      ← source HTML snapshot
  WelcomeHero.visual.spec.tsx     ← full view test
  Button.visual.spec.tsx          ← per-component test
```

The **view test** renders the full source HTML and the generated `<WelcomeHero />`, then compares full-page screenshots and layout.

Each **component test** loads the same source HTML, locates the matched element using its CSS selector (e.g. `button[data-role='primary']`), screenshots just that element, then mounts the React component in isolation and compares.

### Design update tracking

When the design changes, re-run `design-embed` in CI to regenerate component files and the reference HTML snapshot. The Playwright tests then detect any component that no longer matches the updated design.

The React generator uses `@playwright/experimental-ct-react`, so the consuming project should provide the matching Playwright component-test setup.
