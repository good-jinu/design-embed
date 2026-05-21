import { defineConfig } from "../../../packages/config/src/index.ts";

export default defineConfig({
	output: {
		target: "react",
		viewName: "TailwindExample",
		viewsDir: "tests/examples/react-tailwind/expected/src/generated/views",
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
