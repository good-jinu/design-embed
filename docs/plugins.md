---
sidebar_position: 7
---

# Plugins & Transformers

`design-embed` is designed to be extensible. It uses two types of plugins: **Source Plugins** and **Transformer Plugins**.

## Source Plugins

Source plugins fetch or generate the raw HTML/CSS that the compiler uses as input.

### Custom HTML Source Plugin

A source plugin can be local project code. For example, this plugin fetches HTML
from an external URL and returns it to the fetch command.

```typescript
// external-html-plugin.ts
import type {
  Diagnostic,
  PluginDefinition,
  SourcePlugin,
  SourcePluginInput,
  SourcePluginResult
} from "design-embed";

export class ExternalHtmlPlugin implements PluginDefinition, SourcePlugin {
  readonly name = "external-html";
  private readonly options: { url: string };

  constructor(options: { url: string }) {
    this.options = options;
  }

  async run(_input: SourcePluginInput): Promise<SourcePluginResult> {
    try {
      const response = await fetch(this.options.url);
      if (!response.ok) {
        return {
          diagnostics: [
            {
              code: "EXTERNAL_HTML_FETCH_FAILED",
              message: `Failed to fetch HTML: ${response.status} ${response.statusText}`,
              severity: "error"
            }
          ]
        };
      }

      return {
        html: await response.text(),
        diagnostics: []
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const diagnostic: Diagnostic = {
        code: "EXTERNAL_HTML_FETCH_FAILED",
        message,
        severity: "error"
      };
      return { diagnostics: [diagnostic] };
    }
  }
}
```

Use the local plugin from `design-embed.config.ts`:

```typescript
import { defineConfig } from "design-embed";
import { ExternalHtmlPlugin } from "./external-html-plugin";

export default defineConfig({
  plugins: [
    new ExternalHtmlPlugin({
      url: "https://www.scrapethissite.com/pages/"
    })
  ],
  output: {
    viewName: "ScrapeThisSitePages",
    viewsDir: "src/generated/views"
  }
});
```

Then write the fetched HTML to a local source artifact before compiling:

```bash npm2yarn
npm exec design-embed -- --out ./design.html
npm exec design-embed -- --input ./design.html
```

### Figma Plugin (`figma-html`)

The official Figma plugin fetches a configured node from Figma and converts it
to HTML.

**Config**
```typescript
import { defineConfig } from "design-embed";
import { FigmaHtmlPlugin } from "@design-embed/plugin-figma-html";

export default defineConfig({
  plugins: [
    new FigmaHtmlPlugin({
      url: "https://www.figma.com/file/KEY/NAME?node-id=ID"
    })
  ]
});
```

**Usage**
```bash npm2yarn
npm exec design-embed -- --out ./design.html
```

**Credentials:**
The plugin requires either `token` in the `FigmaHtmlPlugin` constructor or a
`FIGMA_TOKEN` environment variable. You can get a Personal Access Token in your
Figma settings.

---

## Transformer Plugins

Transformers allow you to programmatically modify the design AST (Abstract Syntax Tree) after it's parsed but before it's emitted.

### Creating a Transformer

A transformer is a TypeScript file that exports a default object with a `transform` function.

```typescript
// my-transformer.ts
export default {
  name: "remove-comments",
  order: 10,
  transform(context) {
    // Modify context.ast here
    return { ast: context.ast };
  }
};
```

### Loading Transformers

You can load transformers from local files or packages in your config:

```typescript
transformers: [
  { path: "./transformers/my-transformer.ts" },
  { path: "@my-org/shared-transformer", order: 5 }
]
```

### Execution Order
Transformers are executed in order based on their `order` property (lower numbers run first). If orders are tied, they run alphabetically by name.
