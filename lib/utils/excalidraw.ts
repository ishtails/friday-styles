import { resolve } from "node:path";
import { config } from "@/config.ts";
import { resolvePath } from "./path.ts";

export interface ExcalidrawElement {
	id: string;
	type:
		| "rectangle"
		| "ellipse"
		| "diamond"
		| "arrow"
		| "line"
		| "freedraw"
		| "text"
		| "image";
	x: number;
	y: number;
	width: number;
	height: number;
	angle?: number;
	strokeColor?: string;
	strokeWidth?: number;
	strokeStyle?: "solid" | "dashed" | "dotted";
	fillStyle?: "solid" | "hachure" | "cross-hatch" | "zigzag" | "zigzag-line";
	backgroundColor?: string;
	roughness?: number;
	opacity?: number;
	roundness?: { type: number } | null;
	strokeSharpness?: "round" | "sharp";
	groupIds?: string[];
	frameId?: string | null;
	points?: number[][];
	text?: string;
	fontSize?: number;
	fontFamily?: number;
	textAlign?: "left" | "center" | "right";
	verticalAlign?: "top" | "middle" | "bottom";
	baseline?: number;
	version?: number;
	versionNonce?: number;
	isDeleted?: boolean;
	seed?: number;
	updated?: number;
	link?: string | null;
	locked?: boolean;
	boundElements?: unknown[];
	boundElementIds?: unknown[] | null;
	startBinding?: unknown | null;
	endBinding?: unknown | null;
	lastCommittedPoint?: number[] | null;
	startArrowhead?: string | null;
	endArrowhead?: string | null;
	index?: string;
	containerId?: string | null;
	originalText?: string;
}

export interface ExcalidrawDrawing {
	type: "excalidraw";
	version: number;
	source?: string;
	title?: string;
	createdAt?: string;
	elements: ExcalidrawElement[];
	appState?: unknown;
	files?: unknown;
}

export interface LibraryItem {
	id?: string;
	name?: string;
	status?: string;
	elements: ExcalidrawElement[];
	created?: number | string;
}

export interface LibraryFile {
	type: "excalidrawlib";
	version: number;
	source?: string;
	description?: string;
	libraryItems: LibraryItem[];
}

export function isExcalidrawElement(obj: unknown): obj is ExcalidrawElement {
	return (
		typeof obj === "object" &&
		obj !== null &&
		"type" in obj &&
		"id" in obj &&
		"x" in obj &&
		"y" in obj &&
		"width" in obj &&
		"height" in obj
	);
}

export function isExcalidrawDrawing(obj: unknown): obj is ExcalidrawDrawing {
	return (
		typeof obj === "object" &&
		obj !== null &&
		"type" in obj &&
		obj.type === "excalidraw" &&
		"version" in obj &&
		"elements" in obj &&
		Array.isArray((obj as ExcalidrawDrawing).elements)
	);
}

export function generateElementId(existingIds: Set<string>): string {
	let id: string;
	do {
		id = Array.from({ length: 20 }, () =>
			"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".charAt(
				Math.floor(Math.random() * 62),
			),
		).join("");
	} while (existingIds.has(id));
	return id;
}

export function ensureUniqueIds(
	elements: ExcalidrawElement[],
	existingIds: Set<string> = new Set(),
): ExcalidrawElement[] {
	const usedIds = new Set(existingIds);
	return elements.map((element) => {
		if (usedIds.has(element.id)) {
			const newId = generateElementId(usedIds);
			usedIds.add(newId);
			return { ...element, id: newId };
		}
		usedIds.add(element.id);
		return element;
	});
}

export function parseDrawingFile(content: string): ExcalidrawDrawing {
	const parsed = JSON.parse(content);
	if (!isExcalidrawDrawing(parsed)) {
		throw new Error("Invalid Excalidraw drawing file");
	}
	return parsed;
}

export function getElementSummary(elements: ExcalidrawElement[]) {
	const typeCounts: Record<string, number> = {};
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	elements.forEach((element) => {
		typeCounts[element.type] = (typeCounts[element.type] || 0) + 1;
		const elementMaxX = element.x + element.width;
		const elementMaxY = element.y + element.height;
		minX = Math.min(minX, element.x);
		minY = Math.min(minY, element.y);
		maxX = Math.max(maxX, elementMaxX);
		maxY = Math.max(maxY, elementMaxY);
	});

	return {
		total: elements.length,
		typeCounts,
		bounds: {
			x: minX === Infinity ? 0 : minX,
			y: minY === Infinity ? 0 : minY,
			width: maxX === -Infinity ? 0 : maxX - (minX === Infinity ? 0 : minX),
			height: maxY === -Infinity ? 0 : maxY - (minY === Infinity ? 0 : minY),
		},
	};
}

export function mergeElements(
	existing: ExcalidrawElement[],
	newElements: ExcalidrawElement[],
	options: { regenerateIds?: boolean } = {},
): ExcalidrawElement[] {
	const regenerateIds = options.regenerateIds !== false;
	const existingIds = new Set(existing.map((el) => el.id));
	const processedElements = regenerateIds
		? ensureUniqueIds(newElements, existingIds)
		: newElements.map((el) => {
				if (existingIds.has(el.id)) {
					throw new Error(`Element ID conflict: ${el.id}`);
				}
				existingIds.add(el.id);
				return el;
			});
	return [...existing, ...processedElements];
}

export function parseLibraryFile(content: string): LibraryFile {
	const parsed = JSON.parse(content);
	if (parsed.type !== "excalidrawlib") {
		throw new Error("Invalid library file: type must be 'excalidrawlib'");
	}
	if (parsed.library && !parsed.libraryItems) {
		parsed.libraryItems = parsed.library.map(
			(itemArray: unknown[], index: number) => ({
				id: `item_${index}`,
				status: "published",
				elements: itemArray,
			}),
		);
		delete parsed.library;
	}
	return parsed;
}

export function getLibraryMetadata(library: LibraryFile) {
	const itemNames = library.libraryItems
		.map((item) => item.name)
		.filter((name): name is string => Boolean(name));
	return {
		description: library.description || "",
		itemCount: library.libraryItems.length,
		itemNames,
		version: library.version,
	};
}

export function resolveLibraryPath(library: string): string {
	const librariesDir = resolvePath(config.librariesDir);
	const filename = library.endsWith(".excalidrawlib")
		? library
		: `${library}.excalidrawlib`;
	return resolve(librariesDir, filename);
}

export function compressElement(element: ExcalidrawElement): ExcalidrawElement {
	const compressed: ExcalidrawElement = {
		type: element.type,
		id: element.id,
		x: element.x,
		y: element.y,
		width: element.width,
		height: element.height,
	};
	if (element.angle !== undefined && element.angle !== 0)
		compressed.angle = element.angle;
	if (element.strokeColor) compressed.strokeColor = element.strokeColor;
	if (
		element.strokeWidth !== undefined &&
		element.strokeWidth !== 1 &&
		element.strokeWidth !== 2
	) {
		compressed.strokeWidth = element.strokeWidth;
	}
	if (element.strokeStyle && element.strokeStyle !== "solid")
		compressed.strokeStyle = element.strokeStyle;
	if (element.strokeSharpness && element.strokeSharpness !== "round")
		compressed.strokeSharpness = element.strokeSharpness;
	if (element.fillStyle && element.fillStyle !== "solid")
		compressed.fillStyle = element.fillStyle;
	if (element.backgroundColor && element.backgroundColor !== "transparent")
		compressed.backgroundColor = element.backgroundColor;
	if (element.roughness !== undefined && element.roughness !== 1)
		compressed.roughness = element.roughness;
	if (element.opacity !== undefined && element.opacity !== 100)
		compressed.opacity = element.opacity;
	if (element.roundness !== undefined && element.roundness !== null) {
		const defaultRoundness = { type: 1 };
		if (
			JSON.stringify(element.roundness) !== JSON.stringify(defaultRoundness)
		) {
			compressed.roundness = element.roundness;
		}
	}
	if (element.points && element.points.length > 0)
		compressed.points = element.points;
	if (element.text !== undefined) compressed.text = element.text;
	if (element.fontSize !== undefined) compressed.fontSize = element.fontSize;
	if (element.fontFamily !== undefined)
		compressed.fontFamily = element.fontFamily;
	if (element.textAlign && element.textAlign !== "left")
		compressed.textAlign = element.textAlign;
	if (element.verticalAlign && element.verticalAlign !== "top")
		compressed.verticalAlign = element.verticalAlign;
	if (element.baseline !== undefined) compressed.baseline = element.baseline;
	if (element.groupIds && element.groupIds.length > 0)
		compressed.groupIds = element.groupIds;
	if (element.frameId !== undefined && element.frameId !== null)
		compressed.frameId = element.frameId;
	return compressed;
}

export function compressLib(
	libraryItems: LibraryItem[],
	options?: { compressElements?: boolean },
): LibraryItem[] {
	const compressElements = options?.compressElements !== false;
	return libraryItems.map((item) => ({
		...item,
		elements: compressElements
			? (item.elements.map((el) =>
					compressElement(el as ExcalidrawElement),
				) as ExcalidrawElement[])
			: item.elements,
	}));
}

export interface DesignSystem {
	version: number;
	defaults: {
		strokeColor?: string;
		strokeWidth?: number;
		strokeStyle?: "solid" | "dashed" | "dotted";
		strokeSharpness?: "round" | "sharp";
		fillStyle?: "solid" | "hachure" | "cross-hatch" | "zigzag" | "zigzag-line";
		backgroundColor?: string;
		roughness?: number;
		opacity?: number;
		roundness?: { type: number } | null;
		fontSize?: number;
		fontFamily?: number;
		textAlign?: "left" | "center" | "right";
		verticalAlign?: "top" | "middle" | "bottom";
	};
}

const defaultDesignSystem: DesignSystem = {
	version: 1,
	defaults: {
		strokeColor: "#000000",
		strokeWidth: 2,
		strokeStyle: "solid",
		strokeSharpness: "round",
		fillStyle: "solid",
		backgroundColor: "transparent",
		roughness: 1,
		opacity: 100,
		roundness: { type: 1 },
		fontSize: 20,
		fontFamily: 1,
		textAlign: "left",
		verticalAlign: "top",
	},
};

export async function getDesignSystem(): Promise<DesignSystem> {
	const designsDir = resolvePath(config.designsDir);
	const designSystemPath = resolve(designsDir, "system.json");
	const file = Bun.file(designSystemPath);

	if (!(await file.exists())) {
		await Bun.$`mkdir -p ${designsDir}`.quiet();
		await Bun.write(designSystemPath, JSON.stringify(defaultDesignSystem, null, 2));
		return defaultDesignSystem;
	}

	try {
		const content = await file.text();
		const parsed = JSON.parse(content);
		return parsed as DesignSystem;
	} catch {
		return defaultDesignSystem;
	}
}

export async function updateDesignSystem(updates: Partial<DesignSystem["defaults"]>): Promise<DesignSystem> {
	const current = await getDesignSystem();
	const updated: DesignSystem = {
		...current,
		defaults: { ...current.defaults, ...updates },
	};
	const designsDir = resolvePath(config.designsDir);
	const designSystemPath = resolve(designsDir, "system.json");
	await Bun.write(designSystemPath, JSON.stringify(updated, null, 2));
	return updated;
}

export async function applyDesignSystemDefaults(element: Partial<ExcalidrawElement>): Promise<ExcalidrawElement> {
	const designSystem = await getDesignSystem();
	const defaults = designSystem.defaults;

	return {
		id: element.id || generateElementId(new Set()),
		type: element.type || "rectangle",
		x: element.x ?? 0,
		y: element.y ?? 0,
		width: element.width ?? 100,
		height: element.height ?? 100,
		strokeColor: element.strokeColor ?? defaults.strokeColor,
		strokeWidth: element.strokeWidth ?? defaults.strokeWidth,
		strokeStyle: element.strokeStyle ?? defaults.strokeStyle,
		strokeSharpness: element.strokeSharpness ?? defaults.strokeSharpness,
		fillStyle: element.fillStyle ?? defaults.fillStyle,
		backgroundColor: element.backgroundColor ?? defaults.backgroundColor,
		roughness: element.roughness ?? defaults.roughness,
		opacity: element.opacity ?? defaults.opacity,
		roundness: element.roundness ?? defaults.roundness,
		fontSize: element.fontSize ?? defaults.fontSize,
		fontFamily: element.fontFamily ?? defaults.fontFamily,
		textAlign: element.textAlign ?? defaults.textAlign,
		verticalAlign: element.verticalAlign ?? defaults.verticalAlign,
		angle: element.angle,
		points: element.points,
		text: element.text,
		baseline: element.baseline,
		groupIds: element.groupIds,
		frameId: element.frameId,
	} as ExcalidrawElement;
}
