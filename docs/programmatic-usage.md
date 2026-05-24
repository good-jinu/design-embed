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
import { reactTarget } from "@design-embed/target-react";

async function runCompiler() {
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
import { TargetEmitter, TargetEmitInput, TargetEmitResult } from "design-embed";

export const myVueEmitter: TargetEmitter = {
  emit(input: TargetEmitInput): TargetEmitResult {
    const { nodes, config } = input;
    
    // 1. Transform the AST (nodes) into your target format
    const vueCode = transformToVue(nodes);
    
    // 2. Return the file structure
    return {
      files: [
        {
          path: `${config.output?.viewName ?? 'View'}.vue`,
          contents: vueCode
        }
      ]
    };
  }
};
```

## Using Transformers

You can also pass custom transformer functions directly to the engine without using the configuration file.

```typescript
const result = await embed({
  html: sourceHtml,
  targetEmitter: reactEmitter,
  transformers: [
    {
      name: "custom-logger",
      transform: async (context) => {
        console.log("Processing AST nodes:", context.ast.length);
        return { ast: context.ast };
      }
    }
  ]
});
```

## Architecture Summary

When using the core package, keep these roles in mind:

- **`embed()`**: The main entry point. It handles local HTML parsing, transformer execution, component substitution, and target emission.
- **`DesignNode`**: The unified AST format used by the compiler.
- **`TargetEmitter`**: Responsible for taking the final AST and turning it into string-based file output.
- **`Diagnostics`**: A structured way to report errors or warnings back to your calling system.

Source plugins are intentionally separate from `embed()`. Run them before calling the core compiler, then pass the produced HTML/CSS into `embed()`.
