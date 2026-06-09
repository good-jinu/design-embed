---
sidebar_position: 8
---

# Programmatic Usage

While the `design-embed` CLI is the most common way to use the tool, you can also integrate the core compiler engine directly into your own Node.js applications, custom scripts, or build pipelines using the `design-embed` package.

## Installation

```bash npm2yarn
npm install design-embed @design-embed/target-react
```

## Basic Example

The most common programmatic use case is calling the `embed` function. You provide raw HTML/CSS and a target emitter, and it returns the generated files as data.

```typescript
import { embed } from "design-embed";
import { ReactTarget } from "@design-embed/target-react";

async function runCompiler() {
  const reactTarget = new ReactTarget();
  const result = await embed({
    html: '<div class="card">Hello World</div>',
    config: {
      output: {
        target: reactTarget,
        viewName: "MyComponent"
      }
    },
    targetEmitter: reactTarget
  });

  if (result.diagnostics.length > 0) {
    console.log("Diagnostics:", result.diagnostics);
  }

  // Files are returned as { path: string, contents: string }[]
  for (const file of result.files) {
    console.log(`Generated ${file.path}`);
    // You are responsible for writing the files to disk
  }
}
```

## Implementing a Custom Target

If you want to support a framework other than React or HTML, you can implement the `TargetEmitter` interface.

```typescript
import {
  TargetEmitter,
  TargetEmitInput,
  TargetEmitResult,
  unwrapDocument,
} from "design-embed";

export class MyFrameworkTarget implements TargetEmitter {
  emit(input: TargetEmitInput): TargetEmitResult {
    const { config } = input;

    // 1. Strip the document wrapper (see note below)
    const nodes = unwrapDocument(input.nodes);

    // 2. Transform the AST (nodes) into your target format
    const code = transformToMyFramework(nodes);

    // 3. Return the file structure
    return {
      files: [
        {
          path: `${config.output?.viewName ?? 'View'}.view`,
          contents: code
        }
      ]
    };
  }
}
```

### Unwrapping the document

Source HTML (e.g. a Figma export) is often a **full document** — `<html><head>…</head><body>…</body></html>`. Document-level tags are invalid at a component root and render differently when the component is mounted than when the page is loaded standalone, which breaks visual comparison.

`unwrapDocument(nodes)` returns the `<body>`'s direct children (dropping `<head>` metadata) so your component emits a clean fragment. Inputs that are already fragments pass through unchanged, so it is always safe to call.

Call it from **component targets** (React, Vue, VanJS, and your own). Do **not** call it from a target whose output is loaded as a full standalone page (like the built-in HTML target) — there the document tags are valid and re-rooted by the browser.

## Architecture Summary

When using the core package, keep these roles in mind:

- **`embed()`**: The main entry point. It handles local HTML parsing, component substitution, and target emission.
- **`DesignNode`**: The unified AST format used by the compiler.
- **`TargetEmitter`**: Responsible for taking the final AST and turning it into string-based file output.
- **`Diagnostics`**: A structured way to report errors or warnings back to your calling system.

Source plugins are intentionally separate from `embed()`. Run them before calling the core compiler, then pass the produced HTML/CSS into `embed()`.
