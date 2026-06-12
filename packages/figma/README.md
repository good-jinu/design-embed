# @design-embed/figma

The official Figma source plugin for design-embed.

It fetches an explicitly requested Figma node, downloads referenced image fills, and converts the design payload into raw HTML that can be passed into the local compiler. This package is intentionally separate from the core compiler because Figma access may require network calls and credentials, while core compilation stays local and deterministic.
