---
sidebar_position: 7
---

# Plugins

`design-embed` is designed to be extensible. It uses **Source Plugins** to fetch or generate the raw HTML/CSS input.

## Source Plugins

Source plugins fetch or generate the raw HTML/CSS that the compiler uses as input.


### Custom HTML Source Plugin

A source plugin can be local project code. For example, this plugin fetches HTML
from an external URL and returns it to the fetch command.

```typescript
// external-html-plugin.ts
import type {
  Diagnostic,
  SourcePlugin,
  SourcePluginInput,
  SourcePluginResult
} from "design-embed";

export class ExternalHtmlPlugin implements SourcePlugin {
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
  source: new ExternalHtmlPlugin({
    url: "https://www.example.com/"
  }),
  output: {
    viewName: "ExamplePages",
    viewsDir: "src/generated/views"
  }
});
```

Then run the compiler, which fetches and compiles in one step:

```bash npm2yarn
npm exec design-embed
```

### Figma Plugin (`figma-html`)

The official Figma plugin fetches a configured node from Figma and converts it
to HTML.

**Config**
```typescript
import { defineConfig } from "design-embed";
import { FigmaHtmlPlugin } from "@design-embed/figma";

export default defineConfig({
  source: new FigmaHtmlPlugin({
    url: "https://www.figma.com/file/KEY/NAME?node-id=ID"
  })
});
```

**Usage**
```bash npm2yarn
npm exec design-embed
```

**Credentials:**
The plugin requires either `token` in the `FigmaHtmlPlugin` constructor or a
`FIGMA_TOKEN` environment variable. You can get a Personal Access Token in your
Figma settings.

