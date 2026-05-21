import type { SourcePlugin, TransformerPlugin } from "./pluginApi.ts";

export class PluginRegistry {
	#sourcePlugins = new Map<string, SourcePlugin>();
	#transformers: TransformerPlugin[] = [];

	registerSource(plugin: SourcePlugin): void {
		this.#sourcePlugins.set(plugin.name, plugin);
	}

	getSource(name: string): SourcePlugin | undefined {
		return this.#sourcePlugins.get(name);
	}

	listSources(): SourcePlugin[] {
		return [...this.#sourcePlugins.values()].sort((left, right) =>
			left.name.localeCompare(right.name),
		);
	}

	registerTransformer(plugin: TransformerPlugin): void {
		this.#transformers.push(plugin);
	}

	listTransformers(): TransformerPlugin[] {
		return sortTransformers(this.#transformers);
	}
}

export function sortTransformers(
	transformers: TransformerPlugin[],
): TransformerPlugin[] {
	return [...transformers].sort((left, right) => {
		const orderDelta = (left.order ?? 0) - (right.order ?? 0);
		return orderDelta || left.name.localeCompare(right.name);
	});
}
