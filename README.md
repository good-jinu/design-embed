# design-embed

**Embed your design into your existing codebase. Deterministically.**

---

## The Problem

Figma-to-code tools exist. They generate beautiful HTML/CSS that looks exactly like the design.

Then what?

You copy-paste their output into your codebase and spend hours:
- Replacing `<div class="card">` with `<ProductCard>` components
- Converting inline styles to Tailwind classes
- Manually extracting repeated sections into components
- Wiring everything to match your project's conventions

**You don't need another code generator. You need an embedder.**

---

## The Other Problem: AI isn't deterministic

AI-powered tools promise magic. But they deliver:
- Inconsistent class naming
- Hallucinated components you don't have
- Different output every time you run them
- Zero guarantees about what you'll get

**For embedding into production codebases, non-deterministic is non-starter.**

---

## What is design-embed?

**A deterministic engine that transforms static HTML/CSS into your codebase's conventions.**

No AI. No hallucinations. Just predictable, consistent transformations that embed your design directly into your existing project structure.

### How it works

```bash npm2yarn
# 1. Configure your source plugin (Figma, Penpot, Webflow, or any tool)
# 2. Run design-embed — fetches from source and compiles in one step
npm exec design-embed

# 3. Get production-ready components, already embedded into your codebase
```

### What you get

**HTML target (default) — web components, custom elements, plain HTML:**
```
your-project/
├── src/
│   └── generated/
│       └── views/
│           └── ProductList.html        # Embedded HTML with component tags
└── design-embed.config.ts
```

**React target — JSX views with your existing components:**
```
your-project/
├── src/
│   └── generated/
│       └── views/
│           ├── Landing.view.tsx        # Generated React view
│           └── Landing.module.css      # Optional CSS Module output
└── design-embed.config.ts
```

---

## Why deterministic?

| | AI Tools | design-embed |
|---|----------|--------------|
| **Output consistency** | ❌ Changes each run | ✅ Same input = same output |
| **Auditable transformations** | ❌ Black box | ✅ Transparent mapping rules |
| **Works offline** | ❌ Requires API calls | ✅ Local compilation; source plugins opt in |
| **No token costs** | ❌ Pay per generation | ✅ Free forever |
| **CI/CD friendly** | ❌ Unpredictable | ✅ Testable & repeatable |
| **Embeds, not generates** | ❌ Standalone code | ✅ Codebase-aware |

---

## Key Features

### 🔌 Design tool agnostic
Input is HTML. Export from Figma, Penpot, Sketch, Webflow, or write it by hand. We don't care about your design tool's proprietary API. We just embed.

### 🧩 Component mappings
Define exactly which HTML elements become your existing project components using deterministic selectors and prop extraction.

### 🎨 Style convention conversion
- Inline styles → Tailwind classes
- Inline and external CSS → CSS Modules
- Raw design values → Design tokens
- You define the mapping rules

### 📦 Codebase-aware output
Your project has:
- A specific `<Button>` component? We'll use it (as `<Button>` in React, or `<button>` in HTML).
- A Tailwind config with custom colors? We'll respect it.
- Naming conventions (PascalCase for React components, kebab-case for Web Components)? We'll follow them.

### 🧪 Built-in visual regression tests
Both `HtmlTarget` and `ReactTarget` can generate Playwright specs that verify your embedded output matches the original design. The spec loads the source HTML as the reference and the generated output as the actual, then compares screenshots and layout at configurable viewports and interaction states.

### 🔗 Local compiler core. Explicit source steps.
Compilation runs locally and deterministically. Optional source plugins, such as the Figma plugin, run as explicit prestep commands before local compilation.

---

## Quick Example

### HTML target — web components

**Input HTML:**
```html
<div class="filter-section">
  <button>Popularity</button>
  <button>Price: Low to High</button>
</div>
<div class="product-grid">
  <div class="product-card">
    <span class="badge">BEST</span>
    <img src="shoes.jpg" alt="Running Shoes">
    <p class="price">$89.00</p>
  </div>
</div>
```

**Config:**
```typescript
import { defineConfig } from "design-embed";

export default defineConfig({
  source: {
    run: async () => ({
      html: "<div>...</div>", // Replace with your design source
      diagnostics: [],
    }),
  },
  output: {
    viewName: "ProductList",
    viewsDir: "src/generated/views",
  },
  components: [
    { selector: ".filter-section", component: "components/product-filter", importName: "product-filter" },
    { selector: ".product-grid",   component: "components/product-list",   importName: "product-list"   },
    { selector: ".product-card",   component: "components/product-card",   importName: "product-card"   },
  ],
});
```

**Output (`ProductList.html`):**
```html
<product-filter>
  <button>Popularity</button>
  <button>Price: Low to High</button>
</product-filter>
<product-list>
  <product-card>
    <span class="badge">BEST</span>
    <img alt="Running Shoes" src="shoes.jpg"></img>
    <p class="price">$89.00</p>
  </product-card>
</product-list>
```

---

### React target — Tailwind

**Input HTML:**
```html
<section style="padding: 64px; background: #3B82F6;">
  <h1 style="color: white; font-size: 48px;">Welcome</h1>
  <button data-role="primary">Get Started</button>
</section>
```

**Your config:**
```typescript
// design-embed.config.ts
import { defineConfig } from "design-embed";
import { ReactTarget } from "@design-embed/react";

export default defineConfig({
  output: {
    target: new ReactTarget(),
    viewName: "Hero",
    viewsDir: "src/generated/views",
    styleMode: "tailwind"
  },

  tokens: {
    spacing: {
      unit: "px",
      threshold: 0,
      values: {
        "4": 16,
        "16": 64
      }
    },
    typography: {
      unit: "px",
      threshold: 0,
      values: {
        "5xl": 48
      }
    },
    colors: {
      "blue-600": "#3B82F6",
      white: "#ffffff"
    }
  },

  styleMappings: {
    spacing: {
      "padding:spacing.4": "p-4",
      "padding:spacing.16": "p-16"
    },
    colors: {
      "background:colors.blue-600": "bg-blue-600",
      "background:colors.white": "bg-white",
      "color:colors.white": "text-white"
    },
    typography: {
      "font-size:typography.5xl": "text-5xl"
    }
  },

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
});
```

**Output (React + Tailwind):**
```tsx
import { Button } from "@/components/ui/Button";

export function Hero() {
	return (
		<section className="bg-blue-600 p-16">
			<h1 className="text-white text-5xl">Welcome</h1>
			<Button variant="primary">Get Started</Button>
		</section>
	);
}
```

**Embedded. Not generated.**

---

## Who is this for?

- **Teams with established design systems** - You already have components. You need design to embed them, not ignore them.
- **Agency to product** - Taking client designs and embedding into an existing codebase? This is your tool.
- **Open source projects** - Community contributors can submit design changes as HTML, you embed deterministically.
- **Anyone tired of re-writing generated code**

---

## Comparison with existing tools

| | Figma-to-code tools | AI code generators | **design-embed** |
|---|---------------------|--------------------|-------------------|
| **Output** | Standalone code | Unpredictable code | **Embedded code** |
| **Uses my components?** | ❌ No | ❌ Sometimes | ✅ Yes, explicitly |
| **Deterministic?** | ✅ Yes | ❌ No | ✅ Yes |
| **Respects my conventions?** | ❌ No | ❌ Varies | ✅ Yes (via config) |
| **Works offline?** | ✅ Usually | ❌ No | ✅ For local compilation |
| **Free?** | ✅ Usually | ❌ Token costs | ✅ Yes |

---

## Philosophy

**design-embed doesn't pretend to be magic.**

It doesn't guess what you want. It does **exactly what you tell it to do**, every single time.

Embedding shouldn't be creative. It should be mechanical.

That's what we automate.

---

## Get Started

```bash npm2yarn
npm install --save-dev design-embed
npm exec design-embed
```

Or use it programmatically:

```bash npm2yarn
# HTML target (default — no extra package needed)
npm install design-embed

# React target
npm install design-embed @design-embed/react
```

```typescript
import { embed } from "design-embed";
import { ReactTarget } from "@design-embed/react";

// The compiler fetches from source and generates files automatically
const result = await embed({
  config: {
    source: {
      run: async () => ({
        html: "<div>...</div>",
        diagnostics: [],
      }),
    },
    output: {
      target: new ReactTarget(),
      viewName: "ProductList",
      viewsDir: "src/generated/views",
    },
  },
});
```

## Generated File Ownership

Files emitted under `output.viewsDir` are compiler-owned `.view` artifacts. Treat them as disposable output that can be regenerated from the HTML input and config.

Page assemblies and containers outside the generated views directory are developer-owned. Put routing, data loading, state, and product logic there so repeated compiler runs do not overwrite handwritten application code.

---

**Not another code generator. An embedder.**

**design-embed** — Embed your design into your existing codebase. Deterministically.
