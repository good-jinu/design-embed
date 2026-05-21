# design-embed Website

This directory contains the Docusaurus site for `design-embed`, a deterministic compiler for embedding exported design HTML/CSS into production codebases.

The documentation content lives at the repository root in `docs/`. The `website/` package owns the Docusaurus app shell, theme configuration, static assets, generated API documentation, and production build output.

## Toolchain

Use the repository-level pnpm workspace commands. Do not use npm, yarn, bun, or Corepack in this repo.

The expected toolchain is declared in the root `mise.toml`:

```toml
[tools]
node = "24"
pnpm = "11"
```

Install dependencies from the repository root:

```bash
pnpm install
```

## Local Development

From the repository root:

```bash
pnpm --filter website start
```

This starts the Docusaurus development server with live reload.

## Build

From the repository root:

```bash
pnpm docs:build
```

This runs the website build and writes the static site to:

```text
website/build/
```

The build also runs the TypeDoc plugin configured in `website/docusaurus.config.ts`, generating API docs from the exported TypeScript entry points under `packages/*`.

## Serve The Production Build

From the repository root:

```bash
pnpm docs:serve
```

This serves the static output from `website/build/` for local production-style checks.

## Documentation Content

Docusaurus is configured to read docs from:

```text
docs/
```

because `website/docusaurus.config.ts` sets:

```ts
docs: {
  path: '../docs',
  sidebarPath: './sidebars.ts',
}
```

Add or edit user-facing documentation in `docs/`, then update `website/sidebars.ts` when navigation needs to change.

## Static Assets

Static files belong under:

```text
website/static/
```

Current configured asset paths are:

```text
website/static/img/favicon.ico
website/static/img/logo.svg
website/static/img/docusaurus-social-card.jpg
```

Docusaurus copies files from `website/static/` to the root of the generated site, so `website/static/img/logo.svg` is served as `/img/logo.svg`.

## GitHub Pages

The repository includes a GitHub Actions workflow at:

```text
.github/workflows/pages.yml
```

On pushes to `main`, it installs the mise-managed toolchain, runs `pnpm install --frozen-lockfile`, builds the docs with `pnpm docs:build`, and deploys `website/build/` to GitHub Pages.

In GitHub repository settings, configure:

```text
Settings -> Pages -> Source -> GitHub Actions
```

If the site is served from a GitHub project URL such as `https://good-jinu.github.io/design-embed/`, set `url` and `baseUrl` in `website/docusaurus.config.ts` accordingly. If a custom domain such as `https://design-embed.dev` is used, keep `baseUrl: '/'`.

## Checks

Useful repository-level checks:

```bash
pnpm docs:check
pnpm docs:build
pnpm typecheck
```
