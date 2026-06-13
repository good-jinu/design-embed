---
sidebar_position: 2
---

# Getting Started

Welcome to **design-embed**! This guide will help you get up and running with your first design embedding project.

## Prerequisites

- **Node.js**: v26, matching the repository toolchain.
- **Package manager**: npm, Yarn, or pnpm.
- **TypeScript**: While not strictly required (you can use `.js` configs), it is highly recommended for the best experience.

## Installation

Install the CLI as a dev dependency in your project:

```bash npm2yarn
npm install --save-dev design-embed
```

## The Workflow

The standard workflow consists of three main steps:

1. **Source**: Get your design as raw HTML/CSS. You can use the built-in Figma plugin for this.
2. **Configure**: Define how that HTML should be transformed into your project's components and styles.
3. **Embed**: Run the compiler to generate your production-ready view files.

---

## Your First Embed

### 1. Initialize your project

If you haven't already, initialize your project with starter files.

```bash npm2yarn
npm exec design-embed init
```

This creates:

```text
design-embed.config.ts
```

Pass `--force` to overwrite existing files:

```bash npm2yarn
npm exec design-embed -- init --force
```

### 2. Basic Configuration

The generated `design-embed.config.ts` includes a local `HtmlFetcherPlugin`
example. It fetches HTML from `https://www.scrapethissite.com/pages/` and compiles
it when you run:

```bash npm2yarn
npm exec design-embed
```

The plugin is project code inside the generated config, so you can replace the
URL, headers, authentication, parsing, or error handling with the needs of your
own design source.

`design-embed.config.ts` is the default config filename. Pass `--config` only
when your config has a different name or lives in a different location.

Add a target adapter such as React when you want framework output:

```typescript
import { defineConfig } from "design-embed";
import { ReactTarget } from "@design-embed/react";

export default defineConfig({
  source: {
    run: async () => ({
      html: "<div>...</div>",
      diagnostics: [],
    }),
  },
  output: {
    target: new ReactTarget(),
    viewName: "WelcomeHero",
    viewsDir: "src/generated/views",
    styleMode: "inline"
  }
});
```

### 3. Get Design HTML

`design-embed` compiles the HTML provided by the source plugin. You can start by exporting HTML from your design tool or using a source plugin like Figma's.

If you are using Figma, install the Figma source plugin and add it to
`design-embed.config.ts`:

```bash npm2yarn
npm install --save-dev @design-embed/figma @design-embed/react
```

```typescript
import { defineConfig } from "design-embed";
import { FigmaHtmlPlugin } from "@design-embed/figma";
import { ReactTarget } from "@design-embed/react";

export default defineConfig({
  source: new FigmaHtmlPlugin({
    url: "https://www.figma.com/file/KEY/NAME?node-id=ID"
  }),
  output: {
    target: new ReactTarget(),
    viewName: "WelcomeHero",
    viewsDir: "src/generated/views",
    styleMode: "inline"
  }
});
```

### 4. Run the Compiler

Set your Figma personal access token and run the compiler. It fetches and compiles in one step:

```bash npm2yarn
export FIGMA_TOKEN=your_token_here
npm exec design-embed
```

This will create `src/generated/views/WelcomeHero.view.tsx`.

---

## Generate Visual Tests

design-embed can generate Playwright tests that verify each generated component visually matches its source design. When the design changes, re-run the compiler in CI to update the reference snapshots — tests then catch any component that hasn't been updated to match.

### 1. Add test settings to the config

Update `design-embed.config.ts`:

```typescript
import { defineConfig } from "design-embed";
import { ReactTarget } from "@design-embed/react";

export default defineConfig({
  output: {
    target: new ReactTarget(),
    viewName: "WelcomeHero",
    viewsDir: "src/generated/views",
    styleMode: "inline"
  },
  components: [
    {
      selector: "button[data-role='primary']",
      component: "Button",
      props: { variant: "primary", children: "$text" }
    }
  ],
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
});
```

### 2. Compile the React view

```bash npm2yarn
npm exec design-embed
```

### 3. Generate the test files

```bash npm2yarn
npm exec design-embed -- generate-tests
```

This writes one spec per generated component plus a shared reference HTML snapshot:

```text
tests/generated/design-embed/
  WelcomeHero.reference.html    ← source HTML snapshot (updated on each compile)
  WelcomeHero.visual.spec.tsx   ← full view test
  Button.visual.spec.tsx        ← per-component test
```

The **view spec** compares the full source HTML against `<WelcomeHero />` (full-page screenshot + layout).

Each **component spec** locates the matched element in the source HTML by its CSS selector, screenshots just that element, then mounts the React component in isolation and compares.

### 4. Run with Playwright component testing

The generated React tests import from `@playwright/experimental-ct-react`, so your app needs Playwright component testing configured.

```bash npm2yarn
npm install --save-dev @playwright/test @playwright/experimental-ct-react
npm exec playwright install
npm exec playwright -- test -c playwright-ct.config.ts tests/generated/design-embed
```

### Design update tracking

Re-run `design-embed` (step 2) in your CI pipeline whenever the source design changes. This regenerates `WelcomeHero.reference.html` with the latest design. The Playwright tests then fail for any component that no longer matches — signalling that the component needs to be updated.

---

## Next Steps

- [Configuration Guide](./configuration.md): Learn how to map components and snap styles to tokens.
- [CLI Reference](./cli-reference.md): Explore all available commands and flags.
- [Component Mappings](./component-mappings.md): Deep dive into prop extraction and component substitution.
