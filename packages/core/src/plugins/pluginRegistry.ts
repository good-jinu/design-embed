import type { SourcePlugin } from "./pluginApi.ts";

export class PluginRegistry {
	#sourcePlugins = new Map<string, SourcePlugin>();

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
}
