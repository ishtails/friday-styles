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

export function parseDrawingFile(content: string): ExcalidrawDrawing {
	const parsed = JSON.parse(content);
	if (!isExcalidrawDrawing(parsed)) {
		throw new Error("Invalid Excalidraw drawing file");
	}
	return parsed;
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
