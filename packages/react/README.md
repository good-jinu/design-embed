# @design-embed/react

React target support for design-embed.

It provides React-oriented emission behavior for generated views. The target focuses on producing deterministic component output and visual regression tests, making design HTML embeddable in React codebases.

## Usage

```typescript
import { defineConfig } from "design-embed";
import { ReactTarget } from "@design-embed/react";

export default defineConfig({
  output: {
    target: new ReactTarget(),
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

`ReactTarget` is a class — instantiate it with `new ReactTarget()` each time you configure an output target.

## Generated output

For the config above, design-embed produces:

```text
src/generated/views/
  WelcomeHero.view.tsx   ← main view, imports Button locally
  Button.view.tsx        ← Button component scaffold
```

`WelcomeHero.view.tsx`:
```tsx
import { Button } from "./Button.view";

export function WelcomeHero() {
  return (
    <section>
      <Button variant="primary">Get Started</Button>
    </section>
  );
}
```

Every component mapping produces a separate `{ComponentName}.view.tsx` file. The main view always imports from those local files.

## Visual tests

When `generateTests: true` is passed to `embed()` (or via `generate-tests` CLI command), a Playwright component test is generated for each output file:

```text
src/generated/views/tests/
  WelcomeHero.reference.html    ← source HTML snapshot
  WelcomeHero.visual.spec.tsx   ← full view screenshot + layout test
  Button.visual.spec.tsx        ← component-level test
```

The **component spec** locates the matched HTML element in the reference snapshot using its CSS selector, screenshots it, then mounts the React component in isolation and compares. Re-running `embed` in CI updates the reference HTML — tests then fail for any component that no longer matches the updated design.

Requires `@playwright/experimental-ct-react` in the consuming project.
