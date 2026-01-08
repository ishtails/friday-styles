#!/usr/bin/env bun
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { config } from "../config.ts";
import { parseLibraryFile } from "../lib/utils/excalidraw-libs.ts";
import { log } from "../lib/utils/logger.ts";

interface MergeOptions {
	inputLibraries: string[];
	outputLibrary: string;
	outputName?: string;
}

function generateUniqueId(existingIds: Set<string>): string {
	let id: string;
	do {
		id = `merged_${Math.random().toString(36).substring(2, 15)}`;
	} while (existingIds.has(id));
	return id;
}

async function mergeLibraries(libraries: any[]): Promise<any> {
	if (libraries.length === 0) {
		throw new Error("No libraries provided to merge");
	}

	// Start with the first library as base
	const merged = {
		type: "excalidrawlib",
		version: Math.max(...libraries.map((lib) => lib.version || 1)),
		source: "merged",
		libraryItems: [],
	};

	const existingIds = new Set<string>();
	const allItems: any[] = [];

	// Collect all items from all libraries
	for (const library of libraries) {
		let items: any[] = [];

		if (library.libraryItems) {
			// Version 2 format
			items = library.libraryItems;
		} else if (library.library) {
			// Version 1 format - convert to version 2
			items = library.library.map((itemArray: any[], index: number) => ({
				id: `converted_${index}`,
				status: "published",
				elements: itemArray,
			}));
		}

		// Add items with unique IDs
		for (const item of items) {
			let newId = item.id;

			// Ensure unique ID
			if (existingIds.has(newId)) {
				newId = generateUniqueId(existingIds);
			}

			existingIds.add(newId);

			allItems.push({
				...item,
				id: newId,
			});
		}
	}

	merged.libraryItems = allItems;

	await log(
		"info",
		"merge_libraries",
		{
			inputCount: libraries.length,
			outputItemCount: allItems.length,
		},
		`Merged ${libraries.length} libraries into ${allItems.length} items`,
	);

	return merged;
}

async function mergeLibrariesFromFiles(options: MergeOptions): Promise<void> {
	const { inputLibraries, outputLibrary, outputName } = options;

	const librariesDir = resolve(config.librariesDir);
	const allLibraries: any[] = [];

	// Read and parse all input libraries
	for (const libName of inputLibraries) {
		try {
			const libPath = join(
				librariesDir,
				libName.endsWith(".excalidrawlib")
					? libName
					: `${libName}.excalidrawlib`,
			);
			const content = await readFile(libPath, "utf-8");
			const library = parseLibraryFile(content);
			allLibraries.push(library);

			await log(
				"info",
				"merge_libraries",
				{ library: libName },
				`Loaded library: ${libName}`,
			);
		} catch (error) {
			await log(
				"error",
				"merge_libraries",
				{ library: libName },
				`Failed to load library ${libName}: ${error}`,
			);
			throw error;
		}
	}

	// Merge libraries
	const mergedLibrary = await mergeLibraries(allLibraries);

	// Add custom name if provided
	if (outputName) {
		mergedLibrary.name = outputName;
	}

	// Write output library
	const outputPath = join(
		librariesDir,
		outputLibrary.endsWith(".excalidrawlib")
			? outputLibrary
			: `${outputLibrary}.excalidrawlib`,
	);

	try {
		await writeFile(outputPath, JSON.stringify(mergedLibrary, null, 2));
		await log(
			"info",
			"merge_libraries",
			{
				output: outputLibrary,
				itemCount: mergedLibrary.libraryItems.length,
			},
			`Successfully created merged library: ${outputLibrary} with ${mergedLibrary.libraryItems.length} items`,
		);
	} catch (error) {
		await log(
			"error",
			"merge_libraries",
			{ output: outputLibrary },
			`Failed to write merged library: ${error}`,
		);
		throw error;
	}
}

// CLI interface
async function main() {
	const args = process.argv.slice(2);

	if (args.length < 3) {
		console.log(`
Usage: bun run scripts/merge-libraries.ts <output-library> <input-lib1> <input-lib2> [input-lib3...]

Examples:
  bun run scripts/merge-libraries.ts combined-music music-notation music-instruments
  bun run scripts/merge-libraries.ts ui-elements basic-ux-wireframing-elements forms google-icons
  bun run scripts/merge-libraries.ts all-charts gantt data-viz flow-chart-symbols

The output library will be created in the resources/excalidraw-libraries/ directory.
File extensions (.excalidrawlib) are optional.
`);
		process.exit(1);
	}

	const [outputLibrary, ...inputLibraries] = args;

	try {
		await mergeLibrariesFromFiles({
			inputLibraries,
			outputLibrary,
		});

		console.log(
			`✅ Successfully merged ${inputLibraries.length} libraries into ${outputLibrary}`,
		);
	} catch (error) {
		console.error(`❌ Error merging libraries:`, error);
		process.exit(1);
	}
}

if (import.meta.main) {
	main();
}

export { mergeLibraries, mergeLibrariesFromFiles };
