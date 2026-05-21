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

- `packages/core`: compiler engine. Owns HTML parsing, normalized design AST types, diagnostics, component mapping, transformer execution, check-mode comparison, and plugin interfaces. Core must stay target-agnostic and source-tool agnostic.
- `packages/config`: config loading and validation for `.ts`, `.js`, and `.mjs` config files. Keep schema and diagnostic behavior here rather than spreading config checks through emitters.
- `packages/design-embed`: public `design-embed` package. It exposes the programmatic API and owns command-line orchestration: loading config, reading input, invoking explicit source plugins, selecting target emitters, writing generated files, formatting diagnostics, and handling check-mode exit codes.
- `packages/plugin-figma-html`: explicit Figma source plugin. Network access belongs here and should remain opt-in through plugin commands or injected fetchers in tests.
- `packages/target-html`: debug HTML target emitter. It serializes the normalized design AST for inspection.
- `packages/target-react`: React target emitter. It owns JSX emission, component substitution output, prop extraction output, style conversion, Tailwind class mapping, and CSS Modules output.
- `website`: Docusaurus documentation site.

Architectural conventions:

- Keep compilation deterministic: same input HTML/CSS and config should produce byte-stable files and diagnostics.
- Keep the source-plugin boundary explicit. External design APIs produce local artifacts before core compilation; core must not import Figma or other source-tool implementations.
- Keep target logic out of `packages/core`. Add or change framework-specific output in target packages that implement the `TargetEmitter` interface.
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

- Put package-local unit tests next to the package source, for example `packages/core/src/index.test.ts`.
- Put cross-package and fixture-driven tests in `tests/`.
- For compiler output changes, update or add fixtures under `tests/fixtures/**/expected` or `tests/examples/**/expected` and assert exact output strings.
- Assert diagnostics by stable `code`, `message`, `severity`, and structured details when relevant.
- For deterministic behavior, compare repeated compilation results when the feature could affect ordering or formatting.
- Do not require live Figma credentials in the normal test pipeline. Figma helpers should be tested with injected fetchers and fixtures.

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
