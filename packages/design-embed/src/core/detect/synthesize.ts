import type { DesignNode, PropValue } from "../nodes.ts";
import { fingerprint } from "./fingerprint.ts";
import {
	classNamesOf,
	collectText,
	isTextOnly,
	subtreeNodeCount,
	toPascalCase,
	toPropName,
} from "./util.ts";

export interface SynthesizeOptions {
	minOccurrences: number;
	minSubtreeSize: number;
}

/**
 * A repeated text-only element extracted with the Stage A contract: varying
 * root attributes and the whole inner text become props.
 */
interface SimplePlan {
	kind: "simple";
	name: string;
	dynamicAttrs: string[];
	hasText: boolean;
}

/**
 * A repeated element subtree extracted with Stage B nested slots: a shared
 * template carries `slot` nodes / `attributeSlots`, and each occurrence supplies
 * its own values.
 */
interface SlotsPlan {
	kind: "slots";
	name: string;
	template: DesignNode;
	propsByNode: Map<DesignNode, Record<string, PropValue>>;
}

type Plan = SimplePlan | SlotsPlan;

/**
 * Extracts repeated element subtrees into generated components. Text-only
 * repeats use the Stage A contract (children + root-attribute props); repeats
 * with element children use Stage B parallel-diff to parameterize the leaves
 * that vary across instances as nested slots.
 */
export function synthesizeComponents(
	nodes: DesignNode[],
	options: SynthesizeOptions,
): DesignNode[] {
	const groups = new Map<string, DesignNode[]>();
	for (const node of nodes) collectGroups(node, groups, options);

	const plans = buildPlans(groups, options);
	if (plans.size === 0) {
		return nodes;
	}
	return nodes.map((node) => transform(node, plans));
}

/** Collects every element (with enough size) by fingerprint, descending fully. */
function collectGroups(
	node: DesignNode,
	groups: Map<string, DesignNode[]>,
	options: SynthesizeOptions,
): void {
	if (node.kind !== "element") {
		return;
	}
	if (subtreeNodeCount(node) >= options.minSubtreeSize) {
		const key = fingerprint(node);
		const list = groups.get(key) ?? [];
		list.push(node);
		groups.set(key, list);
	}
	for (const child of node.children ?? []) {
		collectGroups(child, groups, options);
	}
}

function buildPlans(
	groups: Map<string, DesignNode[]>,
	options: SynthesizeOptions,
): Map<string, Plan> {
	const plans = new Map<string, Plan>();
	const usedNames = new Set<string>();

	for (const [key, instances] of groups) {
		if (instances.length < options.minOccurrences) continue;
		const first = instances[0];
		if (!first) continue;
		const name = () => uniqueName(deriveName(first), usedNames);

		if (instances.every(isTextOnly)) {
			if (!stylesIdentical(instances)) continue; // not contract-expressible
			plans.set(key, {
				kind: "simple",
				name: name(),
				dynamicAttrs: findDynamicAttrs(instances),
				hasText: instances.some((n) => collectText(n) !== ""),
			});
			continue;
		}

		const slots = deriveSlotsPlan(instances, name);
		if (slots) plans.set(key, slots);
	}

	return plans;
}

function transform(node: DesignNode, plans: Map<string, Plan>): DesignNode {
	if (node.kind !== "element") {
		return node;
	}
	const plan = plans.get(fingerprint(node));
	if (plan?.kind === "simple") {
		return toSimpleComponentNode(node, plan);
	}
	if (plan?.kind === "slots" && plan.propsByNode.has(node)) {
		return toSlotsComponentNode(node, plan);
	}
	return {
		...node,
		children: (node.children ?? []).map((c) => transform(c, plans)),
	};
}

// ---------------------------------------------------------------------------
// Stage A: text-only repeats
// ---------------------------------------------------------------------------

function toSimpleComponentNode(node: DesignNode, plan: SimplePlan): DesignNode {
	const props: Record<string, PropValue> = {};
	for (const attr of plan.dynamicAttrs) {
		props[toPropName(attr)] = {
			kind: "literal",
			value: node.attributes?.[attr] ?? "",
			attribute: attr,
		};
	}
	if (plan.hasText) {
		props.children = { kind: "text", value: collectText(node) };
	}
	return componentNode(plan.name, props, node, node.source);
}

function stylesIdentical(instances: DesignNode[]): boolean {
	const first = JSON.stringify(instances[0]?.styles ?? {});
	return instances.every((n) => JSON.stringify(n.styles ?? {}) === first);
}

function findDynamicAttrs(instances: DesignNode[]): string[] {
	const keys = new Set<string>();
	for (const node of instances) {
		for (const attr of Object.keys(node.attributes ?? {})) {
			if (attr !== "class" && attr !== "style") keys.add(attr);
		}
	}
	return [...keys]
		.filter((attr) => {
			const first = instances[0]?.attributes?.[attr];
			return instances.some((n) => n.attributes?.[attr] !== first);
		})
		.sort();
}

// ---------------------------------------------------------------------------
// Stage B: parallel-diff into nested slots
// ---------------------------------------------------------------------------

function deriveSlotsPlan(
	instances: DesignNode[],
	name: () => string,
): SlotsPlan | null {
	const namer = makeNamer();
	const perInstance = instances.map(() => ({}) as Record<string, PropValue>);
	const template = diffNode(instances, perInstance, namer, "prop");
	if (!template) {
		return null;
	}
	return {
		kind: "slots",
		name: name(),
		template,
		propsByNode: new Map(instances.map((n, i) => [n, perInstance[i] ?? {}])),
	};
}

/**
 * Aligns a set of structurally-identical element nodes and returns a single
 * template where leaves that differ across instances are replaced with slots
 * (text) or `attributeSlots` (attributes). Returns null if the subtree cannot
 * be expressed deterministically (e.g. inline styles differ).
 */
function diffNode(
	instances: DesignNode[],
	perInstance: Record<string, PropValue>[],
	namer: Namer,
	nameHint: string,
): DesignNode | null {
	const first = instances[0];
	if (!first) return null;
	if (!stylesIdentical(instances)) return null; // can't parameterize styles

	const template: DesignNode = {
		kind: "element",
		tagName: first.tagName,
		attributes: { ...(first.attributes ?? {}) },
		styles: first.styles,
		source: first.source,
	};

	const attributeSlots: Record<string, string> = {};
	for (const attr of attributeKeys(instances)) {
		const values = instances.map((n) => n.attributes?.[attr]);
		if (allEqual(values)) continue;
		const propName = namer.next(toPropName(attr));
		attributeSlots[attr] = propName;
		values.forEach((value, i) => {
			(perInstance[i] as Record<string, PropValue>)[propName] = {
				kind: "literal",
				value: value ?? "",
				attribute: attr,
			};
		});
	}
	if (Object.keys(attributeSlots).length > 0) {
		template.attributeSlots = attributeSlots;
	}

	const ref = first.children ?? [];
	const sameShape = instances.every((n) =>
		sameChildShape(n.children ?? [], ref),
	);

	if (sameShape) {
		const children: DesignNode[] = [];
		for (let idx = 0; idx < ref.length; idx++) {
			const child = ref[idx];
			if (!child) continue;
			if (child.kind === "element") {
				const aligned = instances.map((n) => n.children?.[idx]);
				if (aligned.some((c) => !c)) return null;
				const sub = diffNode(
					aligned as DesignNode[],
					perInstance,
					namer,
					baseName(child),
				);
				if (!sub) return null;
				children.push(sub);
				continue;
			}
			if (child.kind === "text") {
				const values = instances.map((n) => n.children?.[idx]?.text ?? "");
				if (allEqual(values)) {
					children.push(child);
					continue;
				}
				const propName = namer.next(nameHint);
				values.forEach((value, i) => {
					(perInstance[i] as Record<string, PropValue>)[propName] = {
						kind: "text",
						value,
					};
				});
				children.push({ kind: "slot", propName });
				continue;
			}
			children.push(child);
		}
		template.children = children;
		return template;
	}

	// Fall back to aligning element children by element index; keep the first
	// instance's non-element children static.
	const elementChildren = instances.map((n) =>
		(n.children ?? []).filter((c) => c.kind === "element"),
	);
	let elementIndex = 0;
	const children: DesignNode[] = [];
	for (const child of ref) {
		if (child.kind !== "element") {
			children.push(child);
			continue;
		}
		const cursor = elementIndex++;
		const aligned = elementChildren.map((arr) => arr[cursor]);
		if (aligned.some((c) => !c)) return null;
		const sub = diffNode(
			aligned as DesignNode[],
			perInstance,
			namer,
			baseName(child),
		);
		if (!sub) return null;
		children.push(sub);
	}
	template.children = children;
	return template;
}

function toSlotsComponentNode(node: DesignNode, plan: SlotsPlan): DesignNode {
	return componentNode(
		plan.name,
		plan.propsByNode.get(node) ?? {},
		plan.template,
		node.source,
	);
}

function attributeKeys(instances: DesignNode[]): string[] {
	const keys = new Set<string>();
	for (const node of instances) {
		for (const attr of Object.keys(node.attributes ?? {})) {
			if (attr !== "class" && attr !== "style") keys.add(attr);
		}
	}
	return [...keys].sort();
}

function sameChildShape(children: DesignNode[], ref: DesignNode[]): boolean {
	if (children.length !== ref.length) return false;
	return ref.every((refChild, idx) => {
		const child = children[idx];
		if (!child || child.kind !== refChild.kind) return false;
		if (child.kind === "element") {
			return fingerprint(child) === fingerprint(refChild);
		}
		return true;
	});
}

function allEqual<T>(values: T[]): boolean {
	return values.every((value) => value === values[0]);
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function componentNode(
	name: string,
	props: Record<string, PropValue>,
	sourceElement: DesignNode,
	source: DesignNode["source"],
): DesignNode {
	return {
		kind: "component",
		component: name,
		importName: name,
		importPath: `./${name}.view`,
		props,
		sourceElement,
		source,
	};
}

const SEMANTIC_NAMES: Record<string, string> = {
	h1: "title",
	h2: "title",
	h3: "title",
	h4: "title",
	h5: "title",
	h6: "title",
	p: "text",
	span: "text",
	a: "label",
	button: "label",
	li: "item",
	img: "image",
};

/** A naming base for a slot derived from an element's class or semantics. */
function baseName(node: DesignNode): string {
	const cls = classNamesOf(node)[0];
	if (cls) return toPropName(cls);
	return SEMANTIC_NAMES[node.tagName ?? ""] ?? node.tagName ?? "prop";
}

function deriveName(node: DesignNode): string {
	const dataComponent = node.attributes?.["data-component"];
	if (dataComponent) return toPascalCase(dataComponent);
	const cls = classNamesOf(node)[0];
	if (cls) return toPascalCase(cls);
	return toPascalCase(node.tagName ?? "Component");
}

function uniqueName(base: string, used: Set<string>): string {
	const name = base || "Component";
	let candidate = name;
	let index = 2;
	while (used.has(candidate)) {
		candidate = `${name}${index++}`;
	}
	used.add(candidate);
	return candidate;
}

interface Namer {
	next(base: string): string;
}

function makeNamer(): Namer {
	const used = new Set<string>();
	return {
		next(base: string): string {
			const root = base || "prop";
			let candidate = root;
			let index = 2;
			while (used.has(candidate)) {
				candidate = `${root}${index++}`;
			}
			used.add(candidate);
			return candidate;
		},
	};
}
