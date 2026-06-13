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

## Output Options

The `output` section controls how and where files are generated.

```typescript
import { ReactTarget } from "@design-embed/react";

output: {
  target: new ReactTarget(),   // Omit for built-in HTML output
  viewName: "LandingPage",     // Name of the generated component
  viewsDir: "src/generated",   // Directory for output files
  styleMode: "tailwind"        // "inline", "tailwind", or "css-modules"
}
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

## Source

- **`source`**: The source plugin instance that fetches or generates the design HTML passed to the compiler (e.g. `new FigmaHtmlPlugin(...)`).

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
