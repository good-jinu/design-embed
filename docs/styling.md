---
sidebar_position: 6
---

# Styling Conventions

`design-embed` supports three different modes for handling styles from the design HTML. You can configure this via `output.styleMode`.

## `styleMode: "inline"` (Default)

This mode keeps all styles as inline attributes (or `style` props in React).

- **Pros**: Zero configuration needed, looks exactly like the design.
- **Cons**: Harder to maintain, doesn't use project classes.

---

## `styleMode: "tailwind"`

This mode converts design styles into Tailwind utility classes based on your mappings.

### How it works
1. The compiler identifies a style property (e.g., `padding: 16px`).
2. It looks for a matching **Token** (e.g., `16` in `spacing` tokens).
3. If found, it looks for a **Style Mapping** (e.g., `"padding:spacing.4": "p-4"`).
4. If found, it adds `p-4` to the `className`.

### Configuration
```typescript
tokens: {
  spacing: { values: { "4": 16 } }
},
styleMappings: {
  spacing: { "padding:spacing.4": "p-4" }
}
```

---

## `styleMode: "css-modules"`

This mode extracts styles into a scoped CSS Module file (`.module.css`).

- **Pros**: Clean JSX, scoped styles, supports all CSS properties.
- **Cons**: Generates an extra file per view.

### Configuration
```typescript
output: {
  styleMode: "css-modules"
}
```

---

## Token Snapping

Regardless of the mode, you can use tokens to normalize design values.

```typescript
tokens: {
  spacing: {
    unit: "px",
    threshold: 2, // If design has 15px or 17px, it snaps to 16px (token "4")
    values: { "4": 16 }
  }
}
```

If a value is snapped to a token, the compiler will use the token's precise value in the output, ensuring consistency across your codebase.

Supported token groups include spacing, sizing, typography, radius, border width, shadow, and colors. Unsupported CSS properties remain in inline styles for React output and are reported as informational diagnostics.
