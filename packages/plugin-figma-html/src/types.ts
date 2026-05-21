export interface ExtractedParams {
	fileKey: string;
	nodeId: string | null;
}

export interface FigmaNode {
	id?: string;
	name?: string;
	type?: string;
	visible?: boolean;
	characters?: string;
	children?: FigmaNode[];
	layoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL" | "GRID" | string;
	layoutSizingHorizontal?: "FIXED" | "HUG" | "FILL" | string;
	layoutSizingVertical?: "FIXED" | "HUG" | "FILL" | string;
	layoutWrap?: "NO_WRAP" | "WRAP" | string;
	primaryAxisSizingMode?: "FIXED" | "AUTO" | string;
	counterAxisSizingMode?: "FIXED" | "AUTO" | string;
	primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN" | string;
	counterAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "BASELINE" | string;
	layoutPositioning?: "ABSOLUTE" | "AUTO" | string;
	layoutAlign?: "INHERIT" | "STRETCH" | "MIN" | "CENTER" | "MAX" | string;
	layoutGrow?: number;
	itemSpacing?: number;
	counterAxisSpacing?: number;
	gridRowGap?: number;
	gridColumnGap?: number;
	gridColumnsSizing?: string;
	gridRowsSizing?: string;
	gridColumnSpan?: number;
	gridRowSpan?: number;
	paddingTop?: number;
	paddingBottom?: number;
	paddingLeft?: number;
	paddingRight?: number;
	absoluteBoundingBox?: {
		x?: number;
		y?: number;
		width?: number;
		height?: number;
	};
	fills?: Array<{
		type?: string;
		opacity?: number;
		scaleMode?: string;
		imageRef?: string;
		imageUrl?: string;
		imageLocalPath?: string;
		color?: {
			r: number;
			g: number;
			b: number;
		};
	}>;
	cornerRadius?: number;
	rectangleCornerRadii?: number[];
	strokes?: Array<{
		type?: string;
		opacity?: number;
		color?: {
			r: number;
			g: number;
			b: number;
		};
	}>;
	strokeWeight?: number;
	strokeAlign?: "INSIDE" | "OUTSIDE" | "CENTER" | string;
	opacity?: number;
	clipsContent?: boolean;
	style?: {
		fontSize?: number;
		fontWeight?: number | string;
		fontFamily?: string;
		lineHeightPx?: number;
	};
}

export interface GeneratedFile {
	path: string;
	contents: string;
}

export type CompilerMode = "react" | "html" | "vanjs";

export type FigmaCompiler = (node: FigmaNode) => GeneratedFile[];
