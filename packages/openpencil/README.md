# @design-embed/openpencil

The official [OpenPencil](https://www.npmjs.com/package/@open-pencil/core) source plugin for design-embed.

It loads a **local** `.fig` or `.pen` file, resolves the requested node, exports its assets (vector subtrees as SVG, image fills from the embedded bytes), and converts the design into raw HTML for the design-embed compiler.

Unlike [`@design-embed/figma`](../figma), this plugin needs **no network access and no token** — everything runs locally against the OpenPencil SDK. It reuses the normalized node types and HTML compiler from `@design-embed/figma`, so both plugins emit the same tree.

## Usage

```ts
// design-embed.config.ts
import { defineConfig } from "design-embed";
import { OpenPencilHtmlPlugin } from "@design-embed/openpencil";

export default defineConfig({
  sources: [
    {
      source: new OpenPencilHtmlPlugin({
        // Local file path, optionally suffixed with #nodeId.
        file: "./designs/home.pen#12:3",
        // Where to write exported assets (relative to cwd). Default: "assets".
        assetsDir: "assets",
      }),
      output: { viewName: "Home" },
    },
  ],
});
```

## Programmatic API

- `OpenPencilHtmlPlugin` — the `SourcePlugin` implementation.
- `fetchOpenPencilNode(filePath, nodeId, options)` — load a file and return the normalized `FigmaNode` tree (with assets exported into `options.outputDir`).
- `extractParamsFromPath(input)` — split a `path#nodeId` reference.
- `proxyToDesignNode(proxy)` — convert an OpenPencil `FigmaNodeProxy` into a `FigmaNode`.
- `exportAssets`, `collectVectorExportNodes` — asset export helpers.

## Limitations

- Operates on local files only; connecting to a running OpenPencil editor is not yet supported.
- Gradient fills are mapped by their stops; the gradient angle is not derived from the OpenPencil gradient transform yet (linear gradients default to top-to-bottom).
