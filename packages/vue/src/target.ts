import type {
	StyleMode,
	TargetEmitInput,
	TargetEmitResult,
	TargetEmitter,
	TargetTestGenerateInput,
	TargetTestGenerateResult,
	TargetTestGenerator,
} from "design-embed";
import { emitComponentSplitViews, emitVueView } from "./emit.ts";
import { vueTestGenerator } from "./generateTests.ts";
import { transformStyles } from "./styles.ts";

export interface VueTargetOptions {
	api?: "composition" | "options";
	styleMode?: StyleMode;
}

export class VueTarget implements TargetEmitter, TargetTestGenerator {
	private options: VueTargetOptions;
	readonly styleMode: StyleMode;

	constructor(options: VueTargetOptions = { api: "composition" }) {
		this.options = options;
		this.styleMode = options.styleMode ?? "inline";
	}

	emit({ nodes, css, config, diagnostics }: TargetEmitInput): TargetEmitResult {
		const viewsDir = String(config?.output?.viewsDir ?? "src/generated/views");
		const viewName = config?.output?.viewName ?? "DesignView";

		const styleResult = transformStyles(
			nodes,
			css,
			config,
			diagnostics,
			this.styleMode,
		);
		const contents = emitVueView(styleResult.nodes, viewName, {
			cssModule: styleResult.cssModule,
			api: this.options.api,
		});

		const files: Array<{ path: string; contents: string }> = [
			{ path: `${viewsDir}/${viewName}.vue`, contents },
		];

		for (const split of emitComponentSplitViews(
			styleResult.nodes,
			viewsDir,
			this.options.api,
		)) {
			files.push(split);
		}

		return { files };
	}

	generateTests(input: TargetTestGenerateInput): TargetTestGenerateResult {
		return vueTestGenerator.generateTests(input);
	}
}
