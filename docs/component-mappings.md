---
sidebar_position: 5
---

# Component Mappings

Component mappings are the core mechanism of `design-embed`. They allow you to define precisely which parts of a design should be replaced by your production components.

Selectors currently support a single element selector made from an optional tag, optional id, classes, and attributes. Descendant selectors, combinators, pseudo selectors, and selector lists are rejected so mappings remain deterministic and easy to audit.

## Basic Mapping

A mapping consists of a `selector` and a `component` definition.

```typescript
{
  selector: ".hero-button",
  component: "@/components/ui/Button",
  importName: "Button"
}
```

This will find any element with the class `hero-button` and replace it with:
`import { Button } from "@/components/ui/Button"`.

## Prop Extraction

You can pass data from the design HTML into your component's props using special expressions.

### `"$text"`
Extracts the inner text content of the matched element.

```typescript
props: {
  label: "$text"
}
```

### `"$attr.name"`
Extracts the value of a specific HTML attribute.

```typescript
props: {
  src: "$attr.src",
  alt: "$attr.alt"
}
```

### `"$children"`
Extracts all child elements and maps them as children of the new component.

```typescript
props: {
  children: "$children"
}
```

### Static Values
You can also pass literal values.

```typescript
props: {
  variant: "primary",
  size: "large"
}
```

---

## Best Practices

### Use Semantic Selectors
Avoid generic selectors like `div`. Instead, use classes or data attributes that represent semantic boundaries in your design (e.g., `.card`, `[data-role='button']`).

### Keep Mapping Focused
Only map components that you actually have in your project. Let `design-embed` handle the layout and simple styling for the rest.

### Redact Secrets
`design-embed` automatically redacts common secret patterns (like "Bearer ...") in diagnostics, but you should avoid putting sensitive data in your design HTML.
