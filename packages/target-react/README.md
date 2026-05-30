# @design-embed/target-react

React target support for design-embed.

It provides React-oriented emission behavior for generated views. The target focuses on producing deterministic component output that can reference configured project components and style conventions, making design HTML embeddable in React codebases.

## Usage

```typescript
import { defineConfig } from "design-embed";
import { ReactTarget } from "@design-embed/target-react";

export default defineConfig({
  output: {
    target: new ReactTarget(),
    viewName: "WelcomeHero",
    viewsDir: "src/generated/views",
    styleMode: "inline",
  },
});
```

`ReactTarget` is a class — instantiate it with `new ReactTarget()` each time you configure an output target.
