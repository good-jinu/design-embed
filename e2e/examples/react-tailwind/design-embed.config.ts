import { defineConfig, fromFile } from "design-embed";
import { reactTarget } from "@design-embed/target-react";

export default defineConfig({
	source: fromFile(new URL("./design.html", import.meta.url)),
	output: {
		target: reactTarget,
		viewName: "TailwindExample",
		viewsDir: new URL("./expected/src/generated/views", import.meta.url),
		styleMode: "tailwind",
	},
	tokens: {
		spacing: {
			unit: "px",
			threshold: 0,
			values: {
				"4": 16,
			},
		},
		typography: {
			unit: "px",
			threshold: 0,
			values: {
				"2xl": 24,
			},
		},
		radius: {
			lg: 8,
		},
		colors: {
			"blue-500": "#3B82F6",
		},
	},
	styleMappings: {
		spacing: {
			"padding:spacing.4": "p-4",
		},
		typography: {
			"font-size:typography.2xl": "text-2xl",
		},
		radius: {
			"border-radius:radius.lg": "rounded-lg",
		},
		colors: {
			"background:colors.blue-500": "bg-blue-500",
		},
	},
});
