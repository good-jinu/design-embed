/**
 * Location in the source HTML file.
 */
export interface SourceLocation {
	/** Absolute offset in characters. */
	offset: number;
	/** 1-based line number. */
	line: number;
	/** 1-based column number. */
	column: number;
}

/**
 * A normalized node in the design AST.
 */
export interface DesignNode {
	/** The type of node. */
	kind: "element" | "text" | "component";
	/** HTML tag name (for element kind). */
	tagName?: string;
	/** HTML attributes (for element kind). */
	attributes?: Record<string, string>;
	/** Parsed inline styles (for element kind). */
	styles?: Record<string, string>;
	/** Utility classes to apply. */
	generatedClassNames?: string[];
	/** Child nodes. */
	children?: DesignNode[];
	/** Inner text content (for text kind). */
	text?: string;
	/** Original location in the source HTML. */
	source?: SourceLocation;
	/** Component name (for component kind). */
	component?: string;
	/** Named export of the component. */
	importName?: string;
	/** Mapped prop values for the component. */
	props?: Record<string, PropValue>;
	/** Import path of the component. */
	importPath?: string;
}

/**
 * A value passed to a component prop.
 */
export type PropValue =
	| { kind: "literal"; value: string | number | boolean }
	| { kind: "text"; value: string }
	| { kind: "children"; value: DesignNode[] };

/**
 * A parsed CSS selector.
 */
export interface ParsedSelector {
	/** Optional tag name. */
	tagName?: string;
	/** Optional ID selector. */
	id?: string;
	/** List of class names. */
	classes: string[];
	/** Attribute selectors. */
	attributes: Record<string, string>;
}
