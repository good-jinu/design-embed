---
"design-embed": minor
"@design-embed/react": minor
"@design-embed/vanjs": minor
"@design-embed/vue": minor
---

Rename `plugin` to `source` in `SourceConfig`; move `styleMode` into target constructors

**Breaking changes:**

- `SourceConfig.plugin` is renamed to `SourceConfig.source`. Update all config files:
  ```diff
  - sources: [{ plugin: fromFile("./design.html"), output: { viewName: "Hero" } }]
  + sources: [{ source: fromFile("./design.html"), output: { viewName: "Hero" } }]
  ```
- `styleMode` is removed from `GlobalOutputConfig` and `SourceOutputConfig`. Pass it to the target constructor instead:
  ```diff
  - output: { target: new ReactTarget(), styleMode: "css-modules" }
  + output: { target: new ReactTarget({ styleMode: "css-modules" }) }
  ```
  `ReactTarget`, `VanJsTarget`, and `VueTarget` each accept `{ styleMode?: "inline" | "css-modules" | "tailwind" }` (default: `"inline"`).
- `SourcePlugin.name` is now optional, so inline source objects no longer require a `name` field.
