import type {
	StyleMode,
	TargetEmitInput,
	TargetEmitResult,
	TargetEmitter,
	TargetTestGenerateInput,
	TargetTestGenerateResult,
	TargetTestGenerator,
} from "design-embed";
import { emitComponentSplitViews, emitReactView } from "./emit.ts";
import { reactTestGenerator } from "./generateTests.ts";
import { transformStyles } from "./styles.ts";

export interface ReactTargetOptions {
	styleMode?: StyleMode;
}

export class ReactTarget implements TargetEmitter, TargetTestGenerator {
	readonly styleMode: StyleMode;

	constructor(options: ReactTargetOptions = {}) {
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
		const contents = emitReactView(styleResult.nodes, viewName, {
			cssModulePath: styleResult.cssModulePath,
		});

		const files: Array<{ path: string; contents: string }> = [
			{ path: `${viewsDir}/${viewName}.view.tsx`, contents },
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
		return reactTestGenerator.generateTests(input);
	}
}
