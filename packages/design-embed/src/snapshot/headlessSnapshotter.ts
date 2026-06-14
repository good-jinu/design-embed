import type {
	DesignSnapshotter,
	SnapshotInput,
	SnapshotResult,
} from "../core/types.ts";

export class HeadlessSnapshotter implements DesignSnapshotter {
	async capture(_input: SnapshotInput): Promise<SnapshotResult> {
		throw new Error(
			"HeadlessSnapshotter is a test-time snapshotter: capture() must be called from within " +
				"generateTests(), not embed(). Set snapshot.mode to 'figma-api' for embed-time capture.",
		);
	}
}
