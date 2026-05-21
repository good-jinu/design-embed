---
sidebar_position: 4
---

# CLI Reference

The `design-embed` CLI is used to compile designs, check for regressions, and run source plugins.

## Main Commands

### `design-embed init`
Creates starter files for a React design embedding workflow.

```bash npm2yarn
npm exec design-embed init
```

This writes:

```text
design-embed.config.ts
design.html
playwright-ct.config.ts
```

Existing files are skipped by default.

**Flags**

- `--view-name`: Name of the generated view in the starter config. Defaults to `WelcomeHero`.
- `--force`: Overwrite existing scaffolded files.
- `--quiet`: Suppress text diagnostics and success output.
- `--format`: Diagnostic output format, either `text` or `json`.
- `--cwd`: Set the working directory.

---

### `design-embed`
Compiles design HTML/CSS into your target format.

```bash npm2yarn
npm exec design-embed -- --input <file> --config <file> [flags]
```

**Flags**

- `--input`: Path to the input HTML file. Required.
- `--config`: Path to your `design-embed.config.ts`, `.js`, or `.mjs` file.
- `--css`: Optional path to a separate CSS file.
- `--quiet`: Suppress text diagnostics and success output.
- `--format`: Diagnostic output format, either `text` or `json`.
- `--cwd`: Set the working directory.

---

### `design-embed check`
Checks if generated files are up-to-date without writing anything. Ideal for CI/CD.

```bash npm2yarn
npm exec design-embed -- check --input <file> --config <file>
```

`check` uses the same flags as the default compile command. By default it compares generated output with files on disk and exits without writing. Pass `--write` to write the generated files instead.

**Exit Codes:**
- `0`: Success. Generated files are current.
- `2`: Error in input, config, or compilation.
- `3`: Generated files are missing or stale (different content).

---

### `design-embed generate-tests`
Generates configured visual regression test code and source fixtures.

```bash npm2yarn
npm exec design-embed -- generate-tests --config <file>
```

The command reads the `tests` section from the config file. For React targets, it emits Playwright component-test code that compares the source HTML/CSS fixture with the generated React view using screenshots and element bounding boxes.

**Flags**

- `--config`: Path to your `design-embed.config.ts`, `.js`, or `.mjs` file. Required.
- `--quiet`: Suppress text diagnostics and success output.
- `--format`: Diagnostic output format, either `text` or `json`.
- `--cwd`: Set the working directory.

---

### `design-embed plugin`
Invokes an explicit source plugin to fetch or prepare design data before local compilation.

```bash npm2yarn
npm exec design-embed -- plugin --config <file> --out <path>
```

The command loads the first source plugin instance from the config file's
`plugins` array. For example, configure `new FigmaHtmlPlugin({ url })`, then run
the command to write the plugin-produced HTML.

**Flags**

- `--config`: Path to a config file containing a source plugin instance. Required.
- `--out`: Path where the generated HTML should be written. Required.
