import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { FigmaNodeProxy } from "@open-pencil/core";
import { proxyToDesignNode } from "./sceneToDesignNode.ts";

/** Builds a structurally-complete proxy stand-in with sane defaults. */
function makeProxy(
	overrides: Partial<Record<string, unknown>>,
): FigmaNodeProxy {
	const base: Record<string, unknown> = {
		id: "1:1",
		name: "Node",
		type: "FRAME",
		visible: true,
		opacity: 1,
		clipsContent: false,
		layoutMode: "NONE",
		layoutWrap: "NO_WRAP",
		primaryAxisAlignItems: "MIN",
		counterAxisAlignItems: "MIN",
		layoutSizingHorizontal: "FIXED",
		layoutSizingVertical: "FIXED",
		layoutPositioning: "AUTO",
		layoutAlign: "INHERIT",
		layoutGrow: 0,
		itemSpacing: 0,
		counterAxisSpacing: 0,
		paddingTop: 0,
		paddingRight: 0,
		paddingBottom: 0,
		paddingLeft: 0,
		topLeftRadius: 0,
		topRightRadius: 0,
		bottomRightRadius: 0,
		bottomLeftRadius: 0,
		cornerRadius: 0,
		fills: [],
		strokes: [],
		strokeWeight: 0,
		strokeAlign: "INSIDE",
		absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 50 },
		children: [],
	};
	return { ...base, ...overrides } as unknown as FigmaNodeProxy;
}

describe("proxyToDesignNode", () => {
	test("maps core identity and bounds", () => {
		const node = proxyToDesignNode(
			makeProxy({
				id: "2:5",
				name: "Hero",
				type: "FRAME",
				absoluteBoundingBox: { x: 10, y: 20, width: 300, height: 120 },
			}),
		);
		assert.equal(node.id, "2:5");
		assert.equal(node.name, "Hero");
		assert.equal(node.type, "FRAME");
		assert.deepEqual(node.absoluteBoundingBox, {
			x: 10,
			y: 20,
			width: 300,
			height: 120,
		});
	});

	test("only emits layout fields that carry meaning", () => {
		const plain = proxyToDesignNode(makeProxy({}));
		assert.equal(plain.layoutMode, undefined);
		assert.equal(plain.paddingTop, undefined);
		assert.equal(plain.itemSpacing, undefined);

		const flex = proxyToDesignNode(
			makeProxy({
				layoutMode: "VERTICAL",
				primaryAxisAlignItems: "CENTER",
				itemSpacing: 16,
				paddingTop: 8,
				layoutSizingHorizontal: "FILL",
			}),
		);
		assert.equal(flex.layoutMode, "VERTICAL");
		assert.equal(flex.primaryAxisAlignItems, "CENTER");
		assert.equal(flex.itemSpacing, 16);
		assert.equal(flex.paddingTop, 8);
		assert.equal(flex.layoutSizingHorizontal, "FILL");
	});

	test("folds flat text fields into a style object", () => {
		const node = proxyToDesignNode(
			makeProxy({
				type: "TEXT",
				characters: "Hello",
				fontSize: 24,
				fontWeight: 700,
				fontName: { family: "Inter", style: "Bold" },
				lineHeight: 32,
				textAlignHorizontal: "CENTER",
			}),
		);
		assert.equal(node.characters, "Hello");
		assert.equal(node.style?.fontSize, 24);
		assert.equal(node.style?.fontWeight, 700);
		assert.equal(node.style?.fontFamily, "Inter");
		assert.equal(node.style?.lineHeightPx, 32);
		assert.equal(node.style?.textAlignHorizontal, "CENTER");
	});

	test("maps SOLID and IMAGE fills with renamed fields", () => {
		const node = proxyToDesignNode(
			makeProxy({
				fills: [
					{
						type: "SOLID",
						opacity: 1,
						visible: true,
						color: { r: 1, g: 0, b: 0, a: 1 },
					},
					{
						type: "IMAGE",
						opacity: 1,
						visible: true,
						imageHash: "abc123",
						imageScaleMode: "FILL",
					},
				],
			}),
		);
		const [solid, image] = node.fills ?? [];
		assert.equal(solid?.type, "SOLID");
		assert.deepEqual(solid?.color, { r: 1, g: 0, b: 0, a: 1 });
		assert.equal(image?.type, "IMAGE");
		assert.equal(image?.imageRef, "abc123");
		assert.equal(image?.scaleMode, "FILL");
	});

	test("uses rectangleCornerRadii only when corners differ", () => {
		const uniform = proxyToDesignNode(
			makeProxy({
				topLeftRadius: 8,
				topRightRadius: 8,
				bottomRightRadius: 8,
				bottomLeftRadius: 8,
				cornerRadius: 8,
			}),
		);
		assert.equal(uniform.cornerRadius, 8);
		assert.equal(uniform.rectangleCornerRadii, undefined);

		const mixed = proxyToDesignNode(
			makeProxy({
				topLeftRadius: 8,
				topRightRadius: 0,
				bottomRightRadius: 8,
				bottomLeftRadius: 0,
			}),
		);
		assert.deepEqual(mixed.rectangleCornerRadii, [8, 0, 8, 0]);
	});

	test("recurses into children", () => {
		const node = proxyToDesignNode(
			makeProxy({
				children: [makeProxy({ id: "3:1", type: "TEXT", characters: "Hi" })],
			}),
		);
		assert.equal(node.children?.length, 1);
		assert.equal(node.children?.[0]?.characters, "Hi");
	});
});
