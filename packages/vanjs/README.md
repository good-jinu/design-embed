# @design-embed/vanjs

VanJS target for design-embed. Generates VanJS components from design HTML.

## Installation

```bash
npm install @design-embed/vanjs
```

## Usage

```typescript
import { defineConfig, fromFile } from "design-embed";
import { VanJsTarget } from "@design-embed/vanjs";

export default defineConfig({
  source: fromFile("./design.html"),
  output: {
    target: new VanJsTarget(),
    viewName: "WelcomeHero",
    viewsDir: "src/generated/views",
    styleMode: "inline",
  },
  components: [
    {
      selector: "button[data-role='primary']",
      component: "Button",
      props: { variant: "primary", children: "$text" },
    },
  ],
});
```

## Generated output

For the config above, design-embed produces one `.view.ts` file per view and one per mapped component:

```text
src/generated/views/
  WelcomeHero.view.ts        ← main view, imports Button locally
  Button.view.ts             ← Button component scaffold
  WelcomeHero.mount.entry.ts ← browser entry point for visual tests
  Button.mount.entry.ts
```

`WelcomeHero.view.ts`:
```typescript
import van from "vanjs-core";
import { Button } from "./Button.view";

const { article, h1, p } = van.tags;

export function WelcomeHero() {
  return (
    article({ class: "card", style: "background: #ffffff; padding: 16px;" },
      h1({ "data-role": "title" },
        "Phase One",
      ),
      p(
        "Local HTML compile path.",
      ),
      Button({ variant: "primary" }, "Continue"),
    )
  );
}
```

Each component mapping produces a separate `{ComponentName}.view.ts` file. The main view imports from those local files. Inline styles from the source HTML are emitted as a `style` string attribute on the van element.

The `.mount.entry.ts` files are thin entry points that call `van.add(document.body, Component())` — used by the visual test runner to render the component in a browser page.

## Visual tests

When `generateTests: true` is passed to `embed()` (or via `generate-tests` CLI command), a Playwright test is generated for each output view:

```text
src/generated/views/tests/
  WelcomeHero.reference.html   ← source HTML snapshot
  WelcomeHero.visual.spec.ts   ← full view screenshot + layout test
  Button.visual.spec.ts        ← component-level test
```

The spec loads the `.mount.entry.ts` bundle via `page.goto("file://...")`, screenshots it, and compares against the reference HTML snapshot. Re-running `embed` in CI updates the reference HTML — tests then fail for any component that no longer matches the updated design.

Requires `@playwright/test` and a bundler (e.g. Vite) to build the mount entry files before running tests.
