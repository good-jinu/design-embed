---
id: intro
slug: /
sidebar_position: 1
---

# Design Embed Documentation

Welcome to the official documentation for **design-embed**, a deterministic local compiler for embedding design HTML/CSS into existing codebases.

## Documentation Order

1. **[Getting Started](./getting-started.md)**: install the toolchain, create a minimal config, and run your first embed.
2. **[Configuration Reference](./configuration.md)**: understand `design-embed.config.ts` and supported fields.
3. **[CLI Reference](./cli-reference.md)**: compile, check generated files, and run explicit source plugin prestep commands.
4. **[Component Mappings](./component-mappings.md)**: replace design HTML nodes with project components and extract props.
5. **[Styling Conventions](./styling.md)**: choose inline styles, Tailwind mappings, or CSS Modules.
6. **[Plugins & Transformers](./plugins.md)**: fetch source artifacts and customize AST transformations.
7. **[Programmatic Usage](./programmatic-usage.md)**: call the compiler from Node.js code.
8. **[API Reference](/api/packages)**: generated TypeDoc reference for exported package APIs.

---

## Why Design Embed?

Unlike generic code generators or non-deterministic AI tools, `design-embed` is built for production teams that need:

- **Predictability**: Same input always yields the same output.
- **Codebase Awareness**: It uses *your* components and *your* styling conventions.
- **CI/CD Readiness**: Built-in check mode to prevent regressions.
- **Privacy**: Core compilation runs locally. Optional source plugins, such as Figma fetching, are explicit prestep commands.
