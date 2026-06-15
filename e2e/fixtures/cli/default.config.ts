export default {
	sources: [{ source: {
		async run() {
			return { html: "<main>Fetched</main>", diagnostics: [] };
		},
	} }],
	output: {
		viewsDir: "generated/views",
	},
};
