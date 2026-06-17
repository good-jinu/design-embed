import type { FigmaNode } from "@design-embed/figma";
import type { FigmaNodeProxy } from "@open-pencil/core";

/**
 * Converts an OpenPencil {@link FigmaNodeProxy} (the SDK's Figma-plugin-style
 * view over the scene graph) into the normalized {@link FigmaNode} tree that
 * the design-embed HTML compiler consumes.
 *
 * The proxy already exposes Figma-plugin field names (`absoluteBoundingBox`,
 * `layoutSizingHorizontal`, `primaryAxisAlignItems`, …), so this is mostly a
 * field rename plus folding the flat text fields into `style` and the four
 * corner radii into `rectangleCornerRadii`.
 */
export function proxyToDesignNode(proxy: FigmaNodeProxy): FigmaNode {
	const node: FigmaNode = {
		id: proxy.id,
		name: proxy.name,
		type: proxy.type,
		visible: proxy.visible,
	};

	const bounds = safeBounds(proxy);
	if (bounds) node.absoluteBoundingBox = bounds;

	if (proxy.opacity !== 1) node.opacity = proxy.opacity;
	if (proxy.clipsContent) node.clipsContent = true;

	applyLayout(proxy, node);
	applyCorners(proxy, node);

	const fills = mapFills(proxy.fills);
	if (fills.length) node.fills = fills;

	const strokes = mapStrokes(proxy.strokes);
	if (strokes.length) {
		node.strokes = strokes;
		if (proxy.strokeWeight) node.strokeWeight = proxy.strokeWeight;
		if (proxy.strokeAlign) node.strokeAlign = proxy.strokeAlign;
	}

	if (proxy.type === "TEXT") {
		node.characters = proxy.characters;
		node.style = {
			fontSize: proxy.fontSize,
			fontWeight: proxy.fontWeight,
			fontFamily: proxy.fontName?.family,
			lineHeightPx: proxy.lineHeight ?? undefined,
			textAlignHorizontal: proxy.textAlignHorizontal,
			textAlignVertical: proxy.textAlignVertical,
		};
	}

	const children = proxy.children;
	if (children?.length) {
		node.children = children.map(proxyToDesignNode);
	}

	return node;
}

function applyLayout(proxy: FigmaNodeProxy, node: FigmaNode): void {
	if (proxy.layoutMode && proxy.layoutMode !== "NONE") {
		node.layoutMode = proxy.layoutMode;
	}
	if (proxy.layoutWrap) node.layoutWrap = proxy.layoutWrap;
	if (proxy.primaryAxisAlignItems) {
		node.primaryAxisAlignItems = proxy.primaryAxisAlignItems;
	}
	if (proxy.counterAxisAlignItems) {
		node.counterAxisAlignItems = proxy.counterAxisAlignItems;
	}
	if (proxy.layoutSizingHorizontal) {
		node.layoutSizingHorizontal = proxy.layoutSizingHorizontal;
	}
	if (proxy.layoutSizingVertical) {
		node.layoutSizingVertical = proxy.layoutSizingVertical;
	}
	if (proxy.layoutPositioning === "ABSOLUTE") {
		node.layoutPositioning = "ABSOLUTE";
	}
	if (proxy.layoutAlign) node.layoutAlign = proxy.layoutAlign;
	if (proxy.layoutGrow) node.layoutGrow = proxy.layoutGrow;
	if (proxy.itemSpacing) node.itemSpacing = proxy.itemSpacing;
	if (proxy.counterAxisSpacing)
		node.counterAxisSpacing = proxy.counterAxisSpacing;
	if (proxy.paddingTop) node.paddingTop = proxy.paddingTop;
	if (proxy.paddingRight) node.paddingRight = proxy.paddingRight;
	if (proxy.paddingBottom) node.paddingBottom = proxy.paddingBottom;
	if (proxy.paddingLeft) node.paddingLeft = proxy.paddingLeft;
}

function applyCorners(proxy: FigmaNodeProxy, node: FigmaNode): void {
	const tl = proxy.topLeftRadius;
	const tr = proxy.topRightRadius;
	const br = proxy.bottomRightRadius;
	const bl = proxy.bottomLeftRadius;
	if (tl !== tr || tr !== br || br !== bl) {
		node.rectangleCornerRadii = [tl, tr, br, bl];
	} else if (typeof proxy.cornerRadius === "number" && proxy.cornerRadius > 0) {
		node.cornerRadius = proxy.cornerRadius;
	}
}

function mapFills(
	fills: FigmaNodeProxy["fills"],
): NonNullable<FigmaNode["fills"]> {
	const out: NonNullable<FigmaNode["fills"]> = [];
	for (const fill of fills ?? []) {
		if (fill.visible === false) continue;
		const mapped: NonNullable<FigmaNode["fills"]>[number] = {
			type: fill.type,
			opacity: fill.opacity,
		};
		if (fill.color) mapped.color = fill.color;
		if (fill.type === "IMAGE") {
			mapped.imageRef = fill.imageHash;
			mapped.scaleMode = fill.imageScaleMode;
		}
		if (fill.type.startsWith("GRADIENT_") && fill.gradientStops) {
			mapped.gradientStops = fill.gradientStops.map((stop) => ({
				position: stop.position,
				color: stop.color,
			}));
		}
		out.push(mapped);
	}
	return out;
}

function mapStrokes(
	strokes: FigmaNodeProxy["strokes"],
): NonNullable<FigmaNode["strokes"]> {
	const out: NonNullable<FigmaNode["strokes"]> = [];
	for (const stroke of strokes ?? []) {
		if (stroke.visible === false) continue;
		out.push({ type: "SOLID", color: stroke.color, opacity: stroke.opacity });
	}
	return out;
}

function safeBounds(
	proxy: FigmaNodeProxy,
): FigmaNode["absoluteBoundingBox"] | undefined {
	try {
		const box = proxy.absoluteBoundingBox;
		if (!box) return undefined;
		return { x: box.x, y: box.y, width: box.width, height: box.height };
	} catch {
		return undefined;
	}
}
