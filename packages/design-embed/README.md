# design-embed

The command-line interface for design-embed.

It runs local HTML/CSS compilation, writes generated output, checks whether generated files are current, and invokes explicit source plugins such as `figma-html`. The CLI is the user-facing workflow layer around the core compiler: it loads config, reads design input, and formats diagnostics for humans or CI.
