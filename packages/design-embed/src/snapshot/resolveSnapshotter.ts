import type { DesignSnapshotter, ResolvedSourceConfig } from "../core/types.ts";
import { FigmaApiSnapshotter } from "./figmaApiSnapshotter.ts";
import { HeadlessSnapshotter } from "./headlessSnapshotter.ts";

export function resolveSnapshotter(
	src: ResolvedSourceConfig,
	figmaToken?: string,
): DesignSnapshotter | null {
	const mode = resolveMode(src);
	if (mode === "none") return null;
	if (mode === "figma-api") {
		if (!figmaToken) {
			throw new Error(
				"snapshot.mode 'figma-api' requires a Figma personal access token. " +
					"Pass it via embed({ figmaToken }) or the FIGMA_TOKEN env variable.",
			);
		}
		return new FigmaApiSnapshotter(figmaToken);
	}
	if (mode === "headless") {
		return new HeadlessSnapshotter();
	}
	return null;
}

function resolveMode(
	src: ResolvedSourceConfig,
): "figma-api" | "headless" | "none" {
	if (src.snapshot.mode !== "none") return src.snapshot.mode;
	if (src.plugin.name === "figma") return "figma-api";
	return "none";
}
