---
sidebar_position: 4
---

# CLI Reference

The `design-embed` CLI is used to compile designs, check for regressions, and run source plugins.

## Main Commands

### `design-embed init`
Creates starter files for a design embedding workflow, including a local custom
HTML fetcher plugin example in `design-embed.config.ts`.

```bash npm2yarn
npm exec design-embed init
```

This writes:

```text
design-embed.config.ts
```

Existing files are skipped by default.
Run `design-embed` to fetch and compile using the generated config.

> **Note:** The `init` command generates a `design-embed.config.ts` with a `HtmlFetcherPlugin` that demonstrates how to fetch HTML from a URL.

**Flags**

- `--view-name`: Name of the generated view in the starter config. Defaults to `WelcomeHero`.
- `--force`: Overwrite existing scaffolded files.
- `--quiet`: Suppress text diagnostics and success output.
- `--format`: Diagnostic output format, either `text` or `json`.
- `--cwd`: Set the working directory.

---

### `design-embed`
Runs the source plugin from the config to fetch design HTML, then compiles it into your target format.

```bash npm2yarn
npm exec design-embed [flags]
```

**Flags**

- `--config`: Path to your config file when it is not `design-embed.config.ts`.
- `--dry-run`: Skip writing generated files to disk.
- `--generate-tests`: Generate visual regression tests alongside output files.
- `--quiet`: Suppress text diagnostics and success output.
- `--format`: Diagnostic output format, either `text` or `json`.
- `--cwd`: Set the working directory.

---

### `design-embed check`
Checks if generated files are up-to-date without writing anything. Ideal for CI/CD.

```bash npm2yarn
npm exec design-embed check
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
npm exec design-embed -- generate-tests
```

The command reads the `tests` section from the config file. For React targets, it emits Playwright component-test code that compares the source HTML/CSS fixture with the generated React view using screenshots and element bounding boxes.

**Flags**

- `--config`: Path to your config file when it is not `design-embed.config.ts`.
- `--quiet`: Suppress text diagnostics and success output.
- `--format`: Diagnostic output format, either `text` or `json`.
- `--cwd`: Set the working directory.

---

