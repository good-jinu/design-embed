import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, mock, test } from "node:test";
import { FigmaApiSnapshotter } from "./figmaApiSnapshotter.ts";
import { HeadlessSnapshotter } from "./headlessSnapshotter.ts";
import { resolveSnapshotter } from "./resolveSnapshotter.ts";

const fakeToken = "figa-token-123";
const fakeFileId = "fileABC";
const fakeNodeId = "1:2";
const fakeImageUrl = "https://cdn.figma.com/fake/image.png";
const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

afterEach(() => {
	mock.restoreAll();
});

// ---------------------------------------------------------------------------
// Group 1: FigmaApiSnapshotter
// ---------------------------------------------------------------------------

describe("FigmaApiSnapshotter", () => {
	test("saves PNG and returns filePath", async () => {
		const dir = mkdtempSync(join(tmpdir(), "snap-test-"));

		let callCount = 0;
		global.fetch = async (url: string | URL | Request) => {
			const urlStr = url.toString();
			callCount++;
			if (urlStr.startsWith("https://api.figma.com")) {
				return {
					ok: true,
					status: 200,
					statusText: "OK",
					json: async () => ({ images: { [fakeNodeId]: fakeImageUrl } }),
				} as Response;
			}
			return {
				ok: true,
				status: 200,
				statusText: "OK",
				arrayBuffer: async () => fakePng.buffer,
			} as Response;
		};

		const snapshotter = new FigmaApiSnapshotter(fakeToken);
		const result = await snapshotter.capture({
			source: {
				html: "",
				diagnostics: [],
				meta: { fileId: fakeFileId, nodeId: fakeNodeId, viewName: "Hero" },
			},
			config: { mode: "figma-api", dir, format: "png", scale: 1 },
			cwd: "/cwd",
		});

		assert.equal(result.filePath, join(dir, "Hero.png"));
		assert.ok(existsSync(result.filePath));
		assert.ok(callCount >= 2);
		rmSync(dir, { recursive: true });
	});

	test("sends X-Figma-Token header", async () => {
		const calls: Array<{ url: string; init?: RequestInit }> = [];

		global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
			calls.push({ url: url.toString(), init });
			return {
				ok: true,
				status: 200,
				statusText: "OK",
				json: async () => ({ images: { [fakeNodeId]: fakeImageUrl } }),
				arrayBuffer: async () => fakePng.buffer,
			} as Response;
		};

		const snapshotter = new FigmaApiSnapshotter(fakeToken);
		await snapshotter
			.capture({
				source: {
					html: "",
					diagnostics: [],
					meta: { fileId: fakeFileId, nodeId: fakeNodeId, viewName: "Hero" },
				},
				config: { mode: "figma-api", dir: tmpdir(), format: "png", scale: 1 },
				cwd: "/cwd",
			})
			.catch(() => {});

		const figmaCall = calls.find((c) => c.url.includes(fakeFileId));
		assert.ok(figmaCall, "no call to Figma API found");
		assert.equal(
			(figmaCall?.init?.headers as Record<string, string>)?.["X-Figma-Token"],
			fakeToken,
		);
	});

	test("throws when Figma API returns non-OK status", async () => {
		global.fetch = async () =>
			({ ok: false, status: 403, statusText: "Forbidden" }) as Response;

		const snapshotter = new FigmaApiSnapshotter(fakeToken);
		await assert.rejects(
			snapshotter.capture({
				source: {
					html: "",
					diagnostics: [],
					meta: { fileId: fakeFileId, nodeId: fakeNodeId, viewName: "Hero" },
				},
				config: { mode: "figma-api", dir: tmpdir(), format: "png", scale: 1 },
				cwd: "/cwd",
			}),
			/403/,
		);
	});

	test("throws when node ID not in API response", async () => {
		global.fetch = async () =>
			({
				ok: true,
				status: 200,
				statusText: "OK",
				json: async () => ({ images: {} }),
			}) as Response;

		const snapshotter = new FigmaApiSnapshotter(fakeToken);
		await assert.rejects(
			snapshotter.capture({
				source: {
					html: "",
					diagnostics: [],
					meta: { fileId: fakeFileId, nodeId: fakeNodeId, viewName: "Hero" },
				},
				config: { mode: "figma-api", dir: tmpdir(), format: "png", scale: 1 },
				cwd: "/cwd",
			}),
			new RegExp(fakeNodeId),
		);
	});
});

// ---------------------------------------------------------------------------
// Group 2: HeadlessSnapshotter
// ---------------------------------------------------------------------------

describe("HeadlessSnapshotter", () => {
	test("capture throws with a clear message", async () => {
		const snapshotter = new HeadlessSnapshotter();
		await assert.rejects(snapshotter.capture({} as never), /test-time/);
	});
});

// ---------------------------------------------------------------------------
// Group 3: resolveSnapshotter
// ---------------------------------------------------------------------------

const makeResolvedSource = (pluginName: string, mode?: string) => ({
	source: {
		name: pluginName,
		run: async () => ({ html: "", diagnostics: [] }),
	},
	snapshot: {
		mode: (mode ?? "none") as "figma-api" | "headless" | "none",
		dir: "/snap",
		format: "png" as const,
		scale: 1,
	},
	output: {
		viewsDir: "/out",
		target: "html" as const,
	},
	components: [],
	tokens: {},
	styleMappings: {},
	tests: {},
});

describe("resolveSnapshotter", () => {
	test("returns null for mode: none", () => {
		assert.equal(resolveSnapshotter(makeResolvedSource("html", "none")), null);
	});

	test("returns FigmaApiSnapshotter for figma plugin (auto-detect)", () => {
		const s = resolveSnapshotter(
			makeResolvedSource("figma", "none"),
			"token123",
		);
		assert.ok(s instanceof FigmaApiSnapshotter);
	});

	test("returns null for non-figma plugin without explicit mode", () => {
		assert.equal(
			resolveSnapshotter(makeResolvedSource("html-file", "none")),
			null,
		);
	});

	test("returns FigmaApiSnapshotter for explicit figma-api mode", () => {
		const s = resolveSnapshotter(
			makeResolvedSource("html-file", "figma-api"),
			"token123",
		);
		assert.ok(s instanceof FigmaApiSnapshotter);
	});

	test("returns HeadlessSnapshotter for explicit headless mode", () => {
		const s = resolveSnapshotter(makeResolvedSource("html-file", "headless"));
		assert.ok(s instanceof HeadlessSnapshotter);
	});

	test("throws when figma-api mode is used without a token", () => {
		assert.throws(
			() =>
				resolveSnapshotter(makeResolvedSource("figma", "figma-api"), undefined),
			/token/i,
		);
	});
});
