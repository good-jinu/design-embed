export type {
	DesignSnapshotter,
	SnapshotInput,
	SnapshotResult,
} from "../core/types.ts";
export { FigmaApiSnapshotter } from "./figmaApiSnapshotter.ts";
export { HeadlessSnapshotter } from "./headlessSnapshotter.ts";
export { resolveSnapshotter } from "./resolveSnapshotter.ts";
