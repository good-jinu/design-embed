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
output: {
  target: "react",             // "react" or "html" (debug)
  viewName: "LandingPage",     // Name of the generated component
  viewsDir: "src/generated",   // Directory for output files
  styleMode: "tailwind"        // "inline", "tailwind", or "css-modules"
}
```

---

## Component Mappings

This is where you tell the compiler to replace specific HTML elements with your actual project components.

```typescript
components: [
  {
    selector: "button[data-role='primary']",
    component: "@/components/ui/Button",
    importName: "Button",
    props: {
      variant: "primary",
      children: "$text"
    }
  }
]
```

- **`selector`**: A CSS selector to match nodes in the design HTML.
- **`component`**: The import path for your component.
- **`importName`**: (Optional) The named export to use.
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

## Plugins & Transformers

- **`plugins`**: Configuration for source plugins (like `figma-html`).
- **`transformers`**: Custom logic to modify the AST before emission.

```typescript
transformers: [
  { path: "./transformers/my-custom-logic.ts", order: 10 }
]
```

---

## Test Generation

The `tests` section controls generated visual regression tests. The first supported target is React, which emits Playwright component-test code that compares the generated React view against the source HTML at configured viewport sizes and interaction states.

```typescript
tests: {
  outputDir: "tests/generated/design-embed",
  runner: "playwright",
  source: {
    html: "./design.html",
    css: "./design.css"
  },
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
npm exec design-embed -- generate-tests --config ./design-embed.config.ts
```

Generated tests perform full-page screenshot equality and compare each collected element's `x`, `y`, `width`, and `height`. The React generator uses `@playwright/experimental-ct-react`, so the consuming project should provide the matching Playwright component-test setup.
