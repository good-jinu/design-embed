import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	buildFigmaImageFillsEndpoint,
	buildFigmaNodeEndpoint,
	extractParamsFromURL,
	fetchFigmaApiResponse,
	fetchFigmaImageFills,
	fetchFigmaNode,
} from "./figmaApi.ts";

describe("extractParamsFromURL", () => {
	test("extracts file key and node id from a Figma design URL", () => {
		assert.deepEqual(
			extractParamsFromURL(
				"https://www.figma.com/design/file123/Sample?node-id=1-2&t=abc",
			),
			{
				fileKey: "file123",
				nodeId: "1:2",
			},
		);
	});

	test("treats non-url input as a raw file key", () => {
		assert.deepEqual(extractParamsFromURL("file123"), {
			fileKey: "file123",
			nodeId: null,
		});
	});
});

describe("buildFigmaNodeEndpoint", () => {
	test("builds root document endpoint", () => {
		assert.equal(
			buildFigmaNodeEndpoint("file123", null),
			"https://api.figma.com/v1/files/file123?depth=2",
		);
	});

	test("builds node endpoint with an encoded node id", () => {
		assert.equal(
			buildFigmaNodeEndpoint("file123", "1:2"),
			"https://api.figma.com/v1/files/file123/nodes?ids=1%3A2",
		);
	});
});

describe("buildFigmaImageFillsEndpoint", () => {
	test("builds image fills endpoint", () => {
		assert.equal(
			buildFigmaImageFillsEndpoint("file123"),
			"https://api.figma.com/v1/files/file123/images",
		);
	});
});

describe("fetchFigmaNode", () => {
	test("uses an injected fetcher and returns the selected node with image fill URLs", async () => {
		const calls: Array<[string, RequestInit | undefined]> = [];
		const fetcher = async (url: string, init?: RequestInit) => {
			calls.push([url, init]);
			if (url.endsWith("/images")) {
				return new Response(
					JSON.stringify({
						images: {
							image123: "https://example.com/image.png",
						},
					}),
				);
			}

			return new Response(
				JSON.stringify({
					nodes: {
						"1:2": {
							document: {
								id: "1:2",
								name: "Button",
								type: "FRAME",
								fills: [{ type: "IMAGE", imageRef: "image123" }],
							},
						},
					},
				}),
			);
		};

		const node = await fetchFigmaNode("file123", "1:2", {
			token: "token",
			fetcher,
		});

		assert.deepEqual(node, {
			id: "1:2",
			name: "Button",
			type: "FRAME",
			fills: [
				{
					type: "IMAGE",
					imageRef: "image123",
					imageUrl: "https://example.com/image.png",
				},
			],
		});
		assert.deepEqual(calls, [
			[
				"https://api.figma.com/v1/files/file123/nodes?ids=1%3A2",
				{
					method: "GET",
					headers: { "X-Figma-Token": "token" },
				},
			],
			[
				"https://api.figma.com/v1/files/file123/images",
				{
					method: "GET",
					headers: { "X-Figma-Token": "token" },
				},
			],
		]);
	});
});

describe("fetchFigmaImageFills", () => {
	test("returns only successful image fill URLs", async () => {
		const fetcher = async () =>
			new Response(
				JSON.stringify({
					images: {
						image123: "https://example.com/image.png",
						image456: null,
					},
				}),
			);

		assert.deepEqual(
			await fetchFigmaImageFills("file123", {
				token: "token",
				fetcher,
			}),
			{
				image123: "https://example.com/image.png",
			},
		);
	});
});

describe("fetchFigmaApiResponse", () => {
	test("returns the raw API payload without extracting a document node", async () => {
		const payload = {
			name: "Raw file response",
			document: { id: "0:0", name: "Document", type: "DOCUMENT" },
		};
		const fetcher = async () => new Response(JSON.stringify(payload));

		assert.deepEqual(
			await fetchFigmaApiResponse("file123", null, {
				token: "token",
				fetcher,
			}),
			payload,
		);
	});
});
