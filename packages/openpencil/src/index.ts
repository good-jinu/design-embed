export type {
	ExtractedParams,
	FigmaNode,
	GeneratedFile,
} from "@design-embed/figma";
export type {
	ExportAssetsOptions,
	ExportedAsset,
} from "./external/assetExporter.ts";
export {
	collectVectorExportNodes,
	exportAssets,
} from "./external/assetExporter.ts";
export type { OpenPencilClientOptions } from "./external/openPencilClient.ts";
export {
	extractParamsFromPath,
	fetchOpenPencilNode,
} from "./external/openPencilClient.ts";
export { proxyToDesignNode } from "./external/sceneToDesignNode.ts";
export type { OpenPencilHtmlPluginOptions } from "./plugin.ts";
export { OpenPencilHtmlPlugin } from "./plugin.ts";
