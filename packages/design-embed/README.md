# design-embed

`design-embed` is the command-line workflow for compiling exported design into files that can live inside an application repository.

The package provides:

- a built-in deterministic HTML output for quick inspection
- config loading and validation
- generated-file writing and check mode
- explicit source-plugin orchestration
- target-adapter orchestration for framework output such as React

Without a target adapter, `design-embed` only emits HTML. Framework packages
such as `@design-embed/react` are separate adapters that must be wired
into your config.

## Quick Start

Create a design HTML file:

```html
<!-- target.html -->
<section style="padding: 24px; background: #f8fafc;">
	<h1 style="font-size: 32px;">Welcome</h1>
	<button data-role="primary">Get started</button>
</section>
```

Run the compiler:

```bash
npx design-embed target.html
```

By default this uses the built-in HTML target and writes:

```text
src/generated/views/debug.html
```

When `components` are configured with the HTML target, two additional files are generated for each view alongside the HTML:

- `ViewName.ts` — a native web component scaffold (`HTMLElement` subclass with `observedAttributes`, lifecycle hooks, and a `render()` method; no React dependency)
- `ViewName.html` — includes `<script type="module" src="./ViewName.js"></script>` at the bottom

## React Adapter Example

Install the React target adapter alongside `design-embed`:

```bash
pnpm add design-embed @design-embed/react
```

Create a config file:

```ts
// design-embed.config.ts
import { defineConfig } from "design-embed";
import { ReactTarget } from "@design-embed/react";

export default defineConfig({
	output: {
		target: new ReactTarget(),
		viewName: "WelcomeHero",
		viewsDir: "src/components",
		assembliesDir: "src/pages",
		styleMode: "inline",
	},
	tests: {
		outputDir: "tests",
	},
});
```

Run the compiler with the config:

```bash
npx design-embed target.html --config design-embed.config.ts
```

This writes React output through the adapter:

```text
src/components/WelcomeHero.view.tsx
src/pages/WelcomeHeroPage.tsx
tests/WelcomeHero.reference.html
tests/WelcomeHero.visual.spec.tsx
```

Skip adapter-provided test generation with:

```bash
npx design-embed target.html --config design-embed.config.ts --no-test
```

## How It Fits Together

`design-embed` owns the user-facing CLI flow: it loads config, reads input,
selects the built-in HTML target or a configured target adapter, writes files,
and formats diagnostics. The framework-specific behavior stays in target
packages that implement the shared target interface.
