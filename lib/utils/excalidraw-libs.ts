import { resolve } from "node:path";
import { config } from "@/config.ts";
import { resolvePath } from "./path.ts";

interface LibraryItem {
	id: string;
	name?: string;
	status?: string;
	elements: unknown[];
	created?: number | string;
}

interface LibraryFile {
	type: "excalidrawlib";
	version: number;
	source?: string;
	description?: string;
	libraryItems: LibraryItem[];
}

export function parseLibraryFile(content: string): LibraryFile {
	const parsed = JSON.parse(content);
	if (parsed.type !== "excalidrawlib") {
		throw new Error("Invalid library file: type must be 'excalidrawlib'");
	}

	if (parsed.library && !parsed.libraryItems) {
		parsed.libraryItems = parsed.library.map((itemArray: unknown[], index: number) => ({
			id: `item_${index}`,
			status: "published",
			elements: itemArray,
		}));
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
