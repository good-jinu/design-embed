export default {
	plugins: [
		{
			name: "test-source",
			async run() {
				return { html: "<section>Custom</section>", diagnostics: [] };
			},
		},
	],
};
