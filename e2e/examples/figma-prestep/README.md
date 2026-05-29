# Figma Prestep Example

The Figma source plugin is an explicit prestep. It may use network access and writes raw design HTML, while core compilation remains local and deterministic.

```bash
FIGMA_TOKEN=... FIGMA_URL=... pnpm design-embed --config tests/examples/figma-prestep/design-embed.config.ts --out tests/examples/figma-prestep/raw-design.html
pnpm design-embed --input tests/examples/figma-prestep/raw-design.html --config tests/examples/react-tailwind/design-embed.config.ts
```
