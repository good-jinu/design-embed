export default {
	sources: [{ plugin: {
		name: "test-source",
		async run() {
			return { html: "<main>Fetched</main>", diagnostics: [] };
		},
	} }],
	output: {
		viewsDir: "generated/views",
	},
};
