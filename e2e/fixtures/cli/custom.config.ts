export default {
	sources: [{ plugin: {
		name: "test-source",
		async run() {
			return { html: "<section>Custom</section>", diagnostics: [] };
		},
	} }],
	output: {
		viewsDir: "generated/views",
	},
};
