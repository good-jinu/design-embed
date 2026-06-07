# @design-embed/target-vue

Vue target for design-embed. Generates Vue SFC components from design HTML.

## Installation

```bash
npm install @design-embed/target-vue
```

## Usage

```typescript
import { defineConfig } from "design-embed";
import { VueTarget } from "@design-embed/target-vue";

export default defineConfig({
  source: fromFile("./design.html"),
  output: {
    target: new VueTarget(),
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

## Options

`VueTarget` accepts an optional options object:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `api` | `"composition" \| "options"` | `"composition"` | Vue API style used in generated files |

```typescript
new VueTarget({ api: "options" })
```

## Generated output

For the config above, design-embed produces one `.vue` file per view and one per mapped component:

```text
src/generated/views/
  WelcomeHero.vue   ← main view, imports Button locally
  Button.vue        ← Button component scaffold
```

**Composition API** (default) — `WelcomeHero.vue`:
```vue
<script setup lang="ts">
import Button from "./Button.vue";
</script>

<template>
  <section>
    <Button variant="primary">
      <template #children>Continue</template>
    </Button>
  </section>
</template>
```

**Options API** — `WelcomeHero.vue`:
```vue
<script lang="ts">
import { defineComponent } from "vue";
export default defineComponent({
  components: { Button }
});
</script>

<template>
  <section>
    <Button variant="primary">
      <template #children>Continue</template>
    </Button>
  </section>
</template>
```

Inline styles from the source HTML are emitted as Vue's `:style` binding. Component children mapped via `$text` are passed through the named `#children` slot.

## Visual tests

When `generateTests: true` is passed to `embed()` (or via `generate-tests` CLI command), a Playwright test is generated for each output view:

```text
src/generated/views/tests/
  WelcomeHero.reference.html    ← source HTML snapshot
  WelcomeHero.visual.spec.ts    ← full view screenshot + layout test
  Button.visual.spec.ts         ← component-level test
```

The spec mounts the Vue component via `@playwright/experimental-ct-vue`, screenshots it, and compares against the reference HTML snapshot. Re-running `embed` in CI updates the reference HTML — tests then fail for any component that no longer matches the updated design.

Requires `@playwright/experimental-ct-vue` in the consuming project.
