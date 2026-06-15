import { defineConfig, fromFile } from "design-embed";
import { ReactTarget } from "@design-embed/react";

export default defineConfig({
	sources: [{ source: fromFile(new URL("./tailwind-card.html", import.meta.url)), output: { viewName: "TailwindCard" } }],
	output: {
		viewsDir: new URL("./generated", import.meta.url),
		target: new ReactTarget({ styleMode: "tailwind" }),
	},
	tests: { assertions: { screenshot: false, layout: false } },
	tokens: {
		spacing: {
			unit: "px",
			threshold: 2,
			values: {
				"4": 16,
			},
		},
		colors: {
			"blue-600": "#3B82F6",
			"neutral-900": "#111827",
		},
		colorThreshold: 4,
	},
	styleMappings: {
		spacing: {
			"padding:spacing.4": "p-4",
		},
		colors: {
			"background-color:colors.blue-600": "bg-blue-600",
			"color:colors.neutral-900": "text-neutral-900",
		},
	},
});
