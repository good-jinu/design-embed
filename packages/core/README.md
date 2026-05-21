# @design-embed/core

Internal deterministic compiler core for design-embed.

It turns local HTML and optional CSS into normalized design nodes, applies configured component substitutions, converts supported style conventions, runs local transformer plugins, and emits generated files for the selected target. It also owns the plugin contracts, diagnostic helpers, and check-mode comparison logic used by the CLI and integrations.
