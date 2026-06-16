import type {
	StyleMode,
	TargetEmitInput,
	TargetEmitResult,
	TargetEmitter,
	TargetTestGenerateInput,
	TargetTestGenerateResult,
	TargetTestGenerator,
} from "design-embed";
import { emitComponentSplitViews, emitVanJsView } from "./emit.ts";
import { vanJsTestGenerator } from "./generateTests.ts";
import { transformStyles } from "./styles.ts";

export interface VanJsTargetOptions {
	styleMode?: StyleMode;
}

export class VanJsTarget implements TargetEmitter, TargetTestGenerator {
	readonly styleMode: StyleMode;

	constructor(options: VanJsTargetOptions = {}) {
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
		const contents = emitVanJsView(styleResult.nodes, viewName, {
			cssModulePath: styleResult.cssModulePath,
		});

		const files: Array<{ path: string; contents: string }> = [
			{ path: `${viewsDir}/${viewName}.view.ts`, contents },
		];
		if (styleResult.cssModule && styleResult.cssModulePath) {
			files.push({
				path: `${viewsDir}/${styleResult.cssModulePath}`,
				contents: styleResult.cssModule,
			});
		}
		for (const split of emitComponentSplitViews(
			styleResult.nodes,
			viewsDir,
			styleResult.cssModulePath,
		)) {
			files.push(split);
		}

		return { files };
	}

	generateTests(input: TargetTestGenerateInput): TargetTestGenerateResult {
		return vanJsTestGenerator.generateTests(input);
	}
}
