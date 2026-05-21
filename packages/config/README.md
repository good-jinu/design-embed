# @design-embed/config

Internal configuration loading and validation for design-embed.

It parses the project config format used by the compiler, validates supported output targets, style modes, component mappings, token settings, plugin settings, and local transformer declarations. It also reports config diagnostics in a stable shape so callers can fail early before compilation begins.
