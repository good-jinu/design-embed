# AGENTS.md

## Package Manager

Use `pnpm` for all workspace operations. Do not use npm, yarn, bun, or Corepack commands in this repository.

The toolchain is declared in `mise.toml`:

```toml
[tools]
node = "24"
pnpm = "11"
```

Run dependency commands from the repository root so `pnpm-workspace.yaml` and `pnpm-lock.yaml` stay authoritative.

## Architecture

This repository is a pnpm monorepo for `design-embed`, a deterministic compiler that embeds exported design HTML/CSS into an existing codebase.

Workspace packages:

- `packages/design-embed`: the public `design-embed` package and the heart of the monorepo. It exposes the programmatic API and owns command-line orchestration: loading config, reading input, invoking explicit source plugins, selecting target adapters, writing generated files, formatting diagnostics, handling check-mode exit codes, and providing the built-in HTML output. It contains two internal modules that are part of its published surface:
  - `src/core`: compiler engine. Owns HTML parsing, normalized design AST types, diagnostics, component mapping, transformer execution, check-mode comparison, and plugin interfaces. The `core` module must stay target-agnostic and source-tool agnostic.
  - `src/config`: config loading and validation for `.ts`, `.js`, and `.mjs` config files. Keep schema and diagnostic behavior here rather than spreading config checks through emitters.
- `packages/plugin-figma-html`: explicit Figma source plugin. Network access belongs here and should remain opt-in through plugin commands or injected fetchers in tests.
- `packages/target-react`: React target adapter. It owns JSX emission, component substitution output, prop extraction output, style conversion, Tailwind class mapping, CSS Modules output, and React-specific test generation.
- `website`: Docusaurus documentation site.

Architectural conventions:

- Keep compilation deterministic: same input HTML/CSS and config should produce byte-stable files and diagnostics.
- Keep the source-plugin boundary explicit. External design APIs produce local artifacts before core compilation; core must not import Figma or other source-tool implementations.
- Keep target logic out of the `core` module (`packages/design-embed/src/core`). Add or change framework-specific output in target packages that implement the `TargetEmitter` interface.
- Treat generated `.view` files and generated CSS Modules as compiler-owned artifacts. Developer-owned routes, state, data loading, and page composition should live outside generated output directories.
- Prefer dependency injection for external effects. Tests for network, filesystem comparison, and emitter selection should use injected fetchers, local fixtures, or generated file data rather than live services.
- Use `workspace:*` for internal package dependencies. Use the pnpm catalog in `pnpm-workspace.yaml` for dependency versions that must stay identical across packages.

## Test Pipeline

Primary verification:

```bash
pnpm test
```

Additional checks:

```bash
pnpm typecheck
pnpm check:fix
pnpm docs:check
pnpm docs:build
```

Test conventions:

- Put package-local unit tests next to the package source, for example `packages/design-embed/src/core/index.test.ts`.
- Put cross-package and fixture-driven tests in `e2e/`.
- For compiler output changes, update or add fixtures under `e2e/fixtures/**/expected*.html` or `e2e/examples/**/expected/` and assert exact output strings.
- Assert diagnostics by stable `code`, `message`, `severity`, and structured details when relevant.
- For deterministic behavior, compare repeated compilation results when the feature could affect ordering or formatting.
- Do not require live Figma credentials in the normal test pipeline. Figma helpers should be tested with injected fetchers and fixtures.

## Versioning

This repository uses [Changesets](https://github.com/changesets/changesets) to manage package versions and changelogs.

**When to add a changeset:**
Add a changeset for every PR that changes the public behavior of a published package (`design-embed`, `@design-embed/plugin-figma-html`, `@design-embed/target-react`). This includes new features, bug fixes, and breaking changes. Note that the `core` and `config` modules now live inside `design-embed`, so behavior changes there require a `design-embed` changeset. Skip changesets for changes that only affect tests, docs, CI, tooling, or the non-published `e2e`/`website` workspaces.

**How to add a changeset:**
Create a file directly in `.changeset/` with a unique kebab-case name (e.g. `.changeset/add-my-feature.md`):

```md
---
"package-name": patch
---

Short description of what changed and why.
```

Replace `"package-name"` with the affected package name(s) and `patch` with the appropriate bump type. Multiple packages can be listed:

```md
---
"design-embed": minor
"@design-embed/target-react": patch
---

Short description.
```

Commit the `.changeset/*.md` file in the same PR as the code change. Do not reuse a filename that already exists in `.changeset/`.

**Bump type guide:**
| Change | Bump |
|---|---|
| Bug fix, internal refactor with no API change | `patch` |
| New exported function, option, or plugin hook | `minor` |
| Removed or renamed export, changed required signature | `major` |

**Release flow (maintainers):**
The `changesets` GitHub Actions workflow runs on every push to `main`. When changeset files are present it opens a "chore: update versions" PR that bumps versions and updates changelogs. Merging that PR triggers publishing to npm.

## Documentation Strategy

Documentation has three layers:

- `README.md`: public-facing introduction, positioning, quick examples, and basic usage.
- `docs/`: user documentation for installation, CLI usage, configuration, component mappings, styling, plugins, and programmatic usage.

Documentation conventions:

- Keep architecture and contributor guidance in `AGENTS.md`; keep task-oriented user docs in `docs/`.
- When behavior changes, update the closest user-facing doc and any affected package README.
- Keep generated API docs under `website/api/` aligned with exported TypeScript surfaces. Regenerate them through the documented pnpm scripts instead of hand-editing generated Markdown.
- Validate documentation links with `pnpm docs:check`.
- Build the Docusaurus site with `pnpm docs:build` before large documentation changes are considered complete.
