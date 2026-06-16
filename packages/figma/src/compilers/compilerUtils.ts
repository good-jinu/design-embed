import type { FigmaNode } from "../types.ts";

export function toComponentName(
	name: string | undefined,
	fallback = "FigmaExport",
): string {
	const cleaned = (name || "").replace(/[^a-zA-Z0-9가-힣]/g, "");
	if (!cleaned) return fallback;
	return /^[0-9]/.test(cleaned) ? `${fallback}${cleaned}` : cleaned;
}

export function escapeHtml(value: string | undefined): string {
	return (value || "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function escapeJsString(value: string | undefined): string {
	return JSON.stringify(value || "");
}

export function getNodeStyles(
	node: FigmaNode,
	parent?: FigmaNode,
): Record<string, string | number> {
	const styles: Record<string, string | number> = {};
	const bounds = node.absoluteBoundingBox;
	const parentBounds = parent?.absoluteBoundingBox;
	const parentUsesLayout = Boolean(
		parent?.layoutMode && parent.layoutMode !== "NONE",
	);
	const isAbsoluteChild = Boolean(
		parent && (!parentUsesLayout || node.layoutPositioning === "ABSOLUTE"),
	);
	const parentDir = parentUsesLayout ? parent?.layoutMode : undefined;
	const fillsHorizontal = node.layoutSizingHorizontal === "FILL";
	const fillsVertical = node.layoutSizingVertical === "FILL";

	if (isAbsoluteChild && bounds && parentBounds) {
		styles.position = "absolute";
		styles.left = `${Math.round((bounds.x || 0) - (parentBounds.x || 0))}px`;
		styles.top = `${Math.round((bounds.y || 0) - (parentBounds.y || 0))}px`;
	} else if (node.children?.length || node.layoutMode === "NONE") {
		styles.position = "relative";
	}

	// A hard pixel size is only emitted for a FIXED axis. HUG (size to content)
	// and FILL (size to parent) are driven by flexbox below; emitting a fixed
	// size for them fights the layout and distorts the result.
	if (bounds && node.layoutSizingHorizontal !== "HUG" && !fillsHorizontal) {
		styles.width = `${Math.round(bounds.width || 0)}px`;
	}
	if (bounds && node.layoutSizingVertical !== "HUG" && !fillsVertical) {
		styles.height = `${Math.round(bounds.height || 0)}px`;
	}

	// A frame that does not clip its content can render larger than its own
	// bounding box (Figma shows the overflow). Absolute children do not expand
	// their parent in CSS, so grow the box to the real content extent — without
	// this a background fill stops short and the overflow renders on bare page.
	if (
		bounds &&
		node.clipsContent !== true &&
		node.children?.length &&
		(node.layoutMode === undefined || node.layoutMode === "NONE")
	) {
		const contentBottom = measureContentBottom(node);
		const overflow = Math.round(contentBottom - (bounds.y || 0));
		if (overflow > Math.round(bounds.height || 0)) {
			styles.height = `${overflow}px`;
		}
	}

	if (node.layoutMode === "HORIZONTAL" || node.layoutMode === "VERTICAL") {
		styles.display = "flex";
		styles.flexDirection = node.layoutMode === "HORIZONTAL" ? "row" : "column";
		styles.boxSizing = "border-box";
		if (node.layoutWrap === "WRAP") styles.flexWrap = "wrap";
		if (node.itemSpacing !== undefined)
			styles.gap = `${Math.round(node.itemSpacing)}px`;
		if (node.counterAxisSpacing !== undefined && node.layoutWrap === "WRAP") {
			styles.rowGap = `${Math.round(node.counterAxisSpacing)}px`;
		}
		styles.justifyContent = mapPrimaryAxisAlignment(node.primaryAxisAlignItems);
		styles.alignItems = mapCounterAxisAlignment(node.counterAxisAlignItems);
	} else if (node.layoutMode === "GRID") {
		styles.display = "grid";
		styles.boxSizing = "border-box";
		if (node.gridColumnsSizing)
			styles.gridTemplateColumns = node.gridColumnsSizing;
		if (node.gridRowsSizing) styles.gridTemplateRows = node.gridRowsSizing;
		if (node.gridColumnGap !== undefined)
			styles.columnGap = `${Math.round(node.gridColumnGap)}px`;
		if (node.gridRowGap !== undefined)
			styles.rowGap = `${Math.round(node.gridRowGap)}px`;
	}

	// Map Figma fill/stretch to flexbox relative to the PARENT's main axis.
	// Filling along the parent's main axis is flex-grow; filling along the cross
	// axis is align-self: stretch. Treating every "fill" as `flex: 1` makes
	// elements (especially text) grow on the wrong axis inside column layouts.
	const growsMainAxis = node.layoutGrow === 1;
	if (parentDir === "HORIZONTAL") {
		if (fillsHorizontal || growsMainAxis) styles.flexGrow = 1;
		if (fillsVertical || node.layoutAlign === "STRETCH")
			styles.alignSelf = "stretch";
	} else if (parentDir === "VERTICAL") {
		if (fillsVertical || growsMainAxis) styles.flexGrow = 1;
		if (fillsHorizontal || node.layoutAlign === "STRETCH")
			styles.alignSelf = "stretch";
	} else {
		// Non-flex / absolutely positioned parent: fill the offset parent box.
		if (fillsHorizontal) styles.width = "100%";
		if (fillsVertical) styles.height = "100%";
	}
	if (node.gridColumnSpan && node.gridColumnSpan > 1) {
		styles.gridColumn = `span ${node.gridColumnSpan}`;
	}
	if (node.gridRowSpan && node.gridRowSpan > 1) {
		styles.gridRow = `span ${node.gridRowSpan}`;
	}

	if (node.paddingTop !== undefined) styles.paddingTop = `${node.paddingTop}px`;
	if (node.paddingBottom !== undefined)
		styles.paddingBottom = `${node.paddingBottom}px`;
	if (node.paddingLeft !== undefined)
		styles.paddingLeft = `${node.paddingLeft}px`;
	if (node.paddingRight !== undefined)
		styles.paddingRight = `${node.paddingRight}px`;
	if (node.clipsContent) styles.overflow = "hidden";
	if (node.opacity !== undefined && node.opacity !== 1)
		styles.opacity = node.opacity;

	const fill = node.fills?.find((item) => item.type === "SOLID" && item.color);
	if (fill?.color) {
		if (node.type === "TEXT") {
			styles.color = toRgba(fill.color, fill.opacity ?? 1);
		} else {
			styles.backgroundColor = toRgba(fill.color, fill.opacity ?? 1);
		}
	}

	const imageFill = node.fills?.find(
		(item) => item.type === "IMAGE" && (item.imageLocalPath || item.imageUrl),
	);
	const imageSource = imageFill?.imageLocalPath || imageFill?.imageUrl;
	if (imageSource) {
		styles.backgroundImage = `url("${imageSource}")`;
		styles.backgroundRepeat = "no-repeat";
		styles.backgroundPosition = "center";
		styles.backgroundSize = mapImageScaleMode(imageFill.scaleMode);
	} else if (node.type !== "TEXT") {
		const gradientFill = node.fills?.find(
			(item) =>
				item.type?.startsWith("GRADIENT_") && item.gradientStops?.length,
		);
		if (gradientFill?.gradientStops?.length) {
			styles.backgroundImage = toCssGradient(gradientFill);
		}
	}

	const stroke = node.strokes?.find(
		(item) => item.type === "SOLID" && item.color,
	);
	if (stroke?.color && node.strokeWeight) {
		styles.border = `${Math.round(node.strokeWeight)}px solid ${toRgba(stroke.color, stroke.opacity ?? 1)}`;
		styles.boxSizing = "border-box";
	}

	if (node.rectangleCornerRadii?.length === 4) {
		styles.borderRadius = node.rectangleCornerRadii
			.map((radius) => `${Math.round(radius)}px`)
			.join(" ");
	} else if (node.cornerRadius) {
		styles.borderRadius = `${Math.round(node.cornerRadius)}px`;
	}

	if (node.type === "TEXT") {
		const textStyle = node.style || {};
		if (textStyle.fontSize) styles.fontSize = `${textStyle.fontSize}px`;
		if (textStyle.fontWeight) styles.fontWeight = textStyle.fontWeight;
		if (textStyle.fontFamily)
			styles.fontFamily = `"${textStyle.fontFamily}", sans-serif`;
		if (textStyle.lineHeightPx)
			styles.lineHeight = `${Math.round(textStyle.lineHeightPx)}px`;
		const textAlign = mapTextAlign(textStyle.textAlignHorizontal);
		if (textAlign) styles.textAlign = textAlign;
	}

	return styles;
}

/**
 * Deepest bottom edge (in absolute canvas coordinates) reachable from this
 * node, descending through children that are not clipped away by a
 * `clipsContent` ancestor. Used to grow non-clipping frames to cover overflow.
 */
function measureContentBottom(node: FigmaNode): number {
	const bounds = node.absoluteBoundingBox;
	let bottom =
		bounds && node.visible !== false
			? (bounds.y || 0) + (bounds.height || 0)
			: -Infinity;
	if (node.clipsContent === true) return bottom;
	for (const child of node.children ?? []) {
		if (child.visible === false) continue;
		bottom = Math.max(bottom, measureContentBottom(child));
	}
	return bottom;
}

function mapTextAlign(value: string | undefined): string | undefined {
	switch (value) {
		case "CENTER":
			return "center";
		case "RIGHT":
			return "right";
		case "JUSTIFIED":
			return "justify";
		case "LEFT":
			return "left";
		default:
			return undefined;
	}
}

export function toReactStyle(styles: Record<string, string | number>): string {
	return JSON.stringify(styles).replace(/"([^"]+)":/g, "$1:");
}

export function toCssText(styles: Record<string, string | number>): string {
	return Object.entries(styles)
		.map(([key, value]) => `${toKebabCase(key)}: ${value};`)
		.join(" ");
}

function toKebabCase(value: string): string {
	return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function mapPrimaryAxisAlignment(value: string | undefined): string {
	switch (value) {
		case "CENTER":
			return "center";
		case "MAX":
			return "flex-end";
		case "SPACE_BETWEEN":
			return "space-between";
		default:
			return "flex-start";
	}
}

function mapCounterAxisAlignment(value: string | undefined): string {
	switch (value) {
		case "CENTER":
			return "center";
		case "MAX":
			return "flex-end";
		case "BASELINE":
			return "baseline";
		default:
			return "flex-start";
	}
}

function mapImageScaleMode(value: string | undefined): string {
	switch (value) {
		case "FIT":
			return "contain";
		case "TILE":
			return "auto";
		default:
			return "cover";
	}
}

function toRgba(
	color: { r: number; g: number; b: number; a?: number },
	opacity: number,
): string {
	return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${(color.a ?? 1) * opacity})`;
}

type GradientFill = NonNullable<FigmaNode["fills"]>[number];

function toCssGradient(fill: GradientFill): string {
	const opacity = fill.opacity ?? 1;
	const stops = (fill.gradientStops || [])
		.map(
			(stop) =>
				`${toRgba(stop.color, opacity)} ${Math.round(stop.position * 100)}%`,
		)
		.join(", ");

	if (fill.type === "GRADIENT_RADIAL" || fill.type === "GRADIENT_DIAMOND") {
		return `radial-gradient(${stops})`;
	}

	// Figma gradient handles are normalized: [0] start, [1] end, y pointing
	// down. CSS angles are clockwise from "to top".
	const [start, end] = fill.gradientHandlePositions || [];
	let angle = 180;
	if (start && end) {
		angle = Math.round(
			(Math.atan2(end.x - start.x, -(end.y - start.y)) * 180) / Math.PI,
		);
		if (angle < 0) angle += 360;
	}
	return `linear-gradient(${angle}deg, ${stops})`;
}
