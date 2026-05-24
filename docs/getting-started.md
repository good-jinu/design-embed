---
sidebar_position: 2
---

# Getting Started

Welcome to **design-embed**! This guide will help you get up and running with your first design embedding project.

## Prerequisites

- **Node.js**: v24, matching the repository toolchain.
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
design.html
playwright-ct.config.ts
```

Pass `--force` to overwrite existing files:

```bash npm2yarn
npm exec design-embed -- init --force
```

### 2. Basic Configuration

The generated `design-embed.config.ts` starts with built-in HTML output. Add a target adapter such as React when you want framework output:

```typescript
import { defineConfig } from "design-embed";
import { reactTarget } from "@design-embed/target-react";

export default defineConfig({
  output: {
    target: reactTarget,
    viewName: "WelcomeHero",
    viewsDir: "src/generated/views",
    styleMode: "inline"
  },
  tests: {
    outputDir: "tests/generated/design-embed",
    runner: "playwright",
    source: {
      html: "./design.html"
    },
    viewports: [
      { name: "mobile", width: 390, height: 844 },
      { name: "desktop", width: 1440, height: 900 }
    ],
    states: [{ name: "default" }],
    assertions: {
      screenshot: true,
      layout: true,
      layoutTolerance: 1,
      selectors: [":scope", ":scope *"]
    }
  }
});
```

### 3. Get Design HTML

`design-embed` compiles local HTML. You can start by editing the generated
`design.html`, exporting HTML from your design tool, or running a source plugin
as an explicit prestep.

If you are using Figma, install the Figma source plugin and add it to
`design-embed.config.ts`:

```bash npm2yarn
npm install --save-dev @design-embed/plugin-figma-html
```

```typescript
import { defineConfig } from "design-embed";
import { FigmaHtmlPlugin } from "@design-embed/plugin-figma-html";
import { reactTarget } from "@design-embed/target-react";

export default defineConfig({
  plugins: [
    new FigmaHtmlPlugin({
      url: "https://www.figma.com/file/KEY/NAME?node-id=ID"
    })
  ],
  output: {
    target: reactTarget,
    viewName: "WelcomeHero",
    viewsDir: "src/generated/views",
    styleMode: "inline"
  }
});
```

Then run the plugin command to write the fetched design HTML to disk:

```bash npm2yarn
# Set your Figma personal access token
export FIGMA_TOKEN=your_token_here

# Fetch a design node
npm exec design-embed -- plugin \
  --config ./design-embed.config.ts \
  --out ./design.html
```

### 4. Run the Compiler

Now, run the compiler to turn that HTML into a React component:

```bash npm2yarn
npm exec design-embed -- --input ./design.html --config ./design-embed.config.ts
```

This will create `src/generated/views/WelcomeHero.view.tsx`.

---

## Generate Visual Tests

You can also generate a Playwright test that compares the original design HTML with the generated React view. This is useful as an end-to-end regression check for viewport-specific layout and visual drift.

### 1. Add test settings to the config

Update `design-embed.config.ts`:

```typescript
import { defineConfig } from "design-embed";
import { reactTarget } from "@design-embed/target-react";

export default defineConfig({
  output: {
    target: reactTarget,
    viewName: "WelcomeHero",
    viewsDir: "src/generated/views",
    styleMode: "inline"
  },
  tests: {
    outputDir: "tests/generated/design-embed",
    runner: "playwright",
    source: {
      html: "./design.html"
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
});
```

If your source uses a separate stylesheet, add it under `tests.source`:

```typescript
source: {
  html: "./design.html",
  css: "./design.css"
}
```

### 2. Compile the React view

```bash npm2yarn
npm exec design-embed -- --input ./design.html --config ./design-embed.config.ts
```

### 3. Generate the test files

```bash npm2yarn
npm exec design-embed -- generate-tests --config ./design-embed.config.ts
```

This writes files like:

```text
tests/generated/design-embed/WelcomeHero.reference.html
tests/generated/design-embed/WelcomeHero.visual.spec.tsx
```

### 4. Run with Playwright component testing

The generated React test imports from `@playwright/experimental-ct-react`, so your app needs Playwright component testing configured.

```bash npm2yarn
npm install --save-dev @playwright/test @playwright/experimental-ct-react
npm exec playwright install
npm exec playwright -- test -c playwright-ct.config.ts tests/generated/design-embed
```

The generated test renders the source HTML and the generated React component at each configured viewport. It compares full-page screenshots and each selected element's `x`, `y`, `width`, and `height`.

---

## Next Steps

- [Configuration Guide](./configuration.md): Learn how to map components and snap styles to tokens.
- [CLI Reference](./cli-reference.md): Explore all available commands and flags.
- [Component Mappings](./component-mappings.md): Deep dive into prop extraction and component substitution.
