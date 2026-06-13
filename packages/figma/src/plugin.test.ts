import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import type { FigmaFetcher } from "./external/figmaApi.ts";
import { FigmaHtmlPlugin } from "./plugin.ts";
import type { FigmaNode } from "./types.ts";

const FILE_URL = "https://www.figma.com/design/key123/Sample?node-id=1-1";

const documentNode: FigmaNode = {
	id: "1:1",
	name: "Company Intro",
	type: "FRAME",
	absoluteBoundingBox: { x: 0, y: 0, width: 1920, height: 1280 },
	fills: [
		{
			type: "GRADIENT_LINEAR",
			gradientHandlePositions: [
				{ x: 0.5, y: 0 },
				{ x: 0.5, y: 1 },
				{ x: 0, y: 0 },
			],
			gradientStops: [
				{ position: 0, color: { r: 0.04, g: 0.09, b: 0.16, a: 1 } },
				{ position: 1, color: { r: 0.09, g: 0.13, b: 0.22, a: 1 } },
			],
		},
	],
	children: [
		{
			id: "10:1",
			name: "Logo",
			type: "GROUP",
			absoluteBoundingBox: { x: 10, y: 10, width: 36, height: 36 },
			children: [
				{
					id: "10:2",
					name: "Vector",
					type: "VECTOR",
					absoluteBoundingBox: { x: 10, y: 10, width: 18, height: 36 },
				},
				{
					id: "10:3",
					name: "Vector",
					type: "VECTOR",
					absoluteBoundingBox: { x: 28, y: 10, width: 18, height: 36 },
				},
			],
		},
		{
			id: "20:1",
			name: "Headline",
			type: "TEXT",
			characters: "We build software that ships",
			absoluteBoundingBox: { x: 10, y: 60, width: 480, height: 32 },
			style: { fontSize: 32, fontWeight: 700, fontFamily: "Inter" },
		},
		{
			id: "30:1",
			name: "Team Photo",
			type: "RECTANGLE",
			absoluteBoundingBox: { x: 10, y: 100, width: 400, height: 300 },
			fills: [{ type: "IMAGE", scaleMode: "FILL", imageRef: "photo-ref" }],
		},
	],
};

/** Routes requests like the real Figma API, without network access. */
const mockFigmaFetcher: FigmaFetcher = async (url) => {
	if (url.startsWith("https://api.figma.com/v1/files/key123/nodes?")) {
		return Response.json({ nodes: { "1:1": { document: documentNode } } });
	}
	if (url === "https://api.figma.com/v1/files/key123/images") {
		return Response.json({
			meta: { images: { "photo-ref": "https://img.test/photo" } },
		});
	}
	if (url.startsWith("https://api.figma.com/v1/images/key123?")) {
		return Response.json({
			err: null,
			images: { "10:1": "https://img.test/icon" },
		});
	}
	if (url === "https://img.test/photo") {
		return new Response("png-bytes", {
			headers: { "content-type": "image/png" },
		});
	}
	if (url === "https://img.test/icon") {
		return new Response("<svg></svg>", {
			headers: { "content-type": "image/svg+xml" },
		});
	}
	return new Response("not found", { status: 404, statusText: "Not Found" });
};

describe("FigmaHtmlPlugin", () => {
	test("compiles a mocked Figma file into an HTML fragment with assets", async () => {
		const cwd = mkdtempSync(join(tmpdir(), "figma-plugin-"));
		const plugin = new FigmaHtmlPlugin({
			url: FILE_URL,
			token: "token",
			fetcher: mockFigmaFetcher,
		});

		try {
			const result = await plugin.run({ cwd });

			assert.deepEqual(result.diagnostics, [
				{
					code: "FIGMA_ASSETS_DOWNLOADED",
					message: "Downloaded 2 image asset(s).",
					severity: "info",
				},
			]);

			const html = result.html ?? "";
			// Fragment output: component targets must not receive a document wrapper.
			assert.match(html, /^<div /);
			assert.doesNotMatch(html, /<html|<head|<body/);

			// The all-vector group is exported once as an SVG image, not as divs.
			assert.match(html, /<img src="assets\/10_1\.svg"[^>]*data-layer="Logo"/);
			assert.doesNotMatch(html, /data-layer="Vector"/);

			// Image fill resolved through meta.images and downloaded locally.
			assert.match(html, /url\(&quot;assets\/photo-ref\.png&quot;\)/);

			// Gradient root background converted to CSS.
			assert.match(
				html,
				/background-image: linear-gradient\(180deg, rgba\(10, 23, 41, 1\) 0%, rgba\(23, 33, 56, 1\) 100%\)/,
			);

			assert.match(html, /We build software that ships/);

			assert.equal(
				readFileSync(join(cwd, "assets", "10_1.svg"), "utf-8"),
				"<svg></svg>",
			);
			assert.equal(
				readFileSync(join(cwd, "assets", "photo-ref.png"), "utf-8"),
				"png-bytes",
			);
		} finally {
			rmSync(cwd, { recursive: true, force: true });
		}
	});

	test("reports an error diagnostic when the API request fails", async () => {
		const plugin = new FigmaHtmlPlugin({
			url: FILE_URL,
			token: "token",
			fetcher: async () =>
				new Response("forbidden", { status: 403, statusText: "Forbidden" }),
		});

		const result = await plugin.run({ cwd: tmpdir() });

		assert.equal(result.html, undefined);
		assert.deepEqual(result.diagnostics, [
			{
				code: "FIGMA_HTML_FAILED",
				message: "Figma API Error: 403 Forbidden",
				severity: "error",
			},
		]);
	});

	test("requires a token when none is configured", async () => {
		const envToken = process.env.FIGMA_TOKEN;
		delete process.env.FIGMA_TOKEN;

		try {
			const plugin = new FigmaHtmlPlugin({ url: FILE_URL });
			const result = await plugin.run({ cwd: tmpdir() });

			assert.equal(result.diagnostics[0]?.code, "FIGMA_TOKEN_REQUIRED");
			assert.equal(result.diagnostics[0]?.severity, "error");
		} finally {
			if (envToken !== undefined) {
				process.env.FIGMA_TOKEN = envToken;
			}
		}
	});
});
