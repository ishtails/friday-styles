import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "@/config.ts";
import type { LibraryItem } from "@/lib/utils/excalidraw.ts";
import {
	compressLib,
	parseLibraryFile,
	resolveLibraryPath,
} from "@/lib/utils/excalidraw.ts";
import { log } from "@/lib/utils/logger.ts";

export const registerViewLibrary = (server: McpServer) => {
	server.registerTool(
		"view_library",
		{
			description: `${config.systemPrompt}\n\nView library items from a specific library file. Returns only the libraryItems array (not full file metadata) with optional compression and filtering. Use querying parameters to find specific components without loading entire libraries. Elements are compressed by default to minimize token usage while preserving visual style.`,
			inputSchema: {
				library: z
					.string()
					.describe(
						"Library filename (with or without .excalidrawlib extension). Use list_libraries to see available libraries.",
					),
				itemIds: z
					.array(z.string())
					.optional()
					.describe("Filter by specific library item IDs."),
				itemNames: z
					.array(z.string())
					.optional()
					.describe("Filter by item names (case-insensitive partial match)."),
				elementTypes: z
					.array(z.string())
					.optional()
					.describe(
						"Filter items containing specific element types (returns items containing ANY of these types).",
					),
				limit: z
					.number()
					.optional()
					.describe("Limit number of items returned."),
				compress: z
					.boolean()
					.optional()
					.default(true)
					.describe(
						"Apply compression to elements (removes default/guessable fields). Defaults to true.",
					),
			},
		},
		async ({
			library,
			itemIds,
			itemNames,
			elementTypes,
			limit,
			compress = true,
		}) => {
			try {
				const fullPath = resolveLibraryPath(library);
				const file = Bun.file(fullPath);

				if (!(await file.exists())) {
					throw new Error(`Library not found: ${library}`);
				}

				const content = await file.text();
				const libraryData = parseLibraryFile(content);

				// Filter library items
				let filteredItems: LibraryItem[] = libraryData.libraryItems;

				// Filter by item IDs
				if (itemIds && itemIds.length > 0) {
					const idSet = new Set(itemIds);
					filteredItems = filteredItems.filter(
						(item) => item.id && idSet.has(item.id),
					);
				}

				// Filter by item names (case-insensitive partial match)
				if (itemNames && itemNames.length > 0) {
					const nameLower = itemNames.map((n) => n.toLowerCase());
					filteredItems = filteredItems.filter((item) => {
						if (!item.name) return false;
						const itemNameLower = item.name.toLowerCase();
						return nameLower.some((n) => itemNameLower.includes(n));
					});
				}

				// Filter by element types (items containing ANY of the specified types)
				if (elementTypes && elementTypes.length > 0) {
					const typeSet = new Set(elementTypes);
					filteredItems = filteredItems.filter((item) => {
						return item.elements.some(
							(el: unknown) =>
								typeof el === "object" &&
								el !== null &&
								"type" in el &&
								typeSet.has(String(el.type)),
						);
					});
				}

				// Apply limit
				if (limit !== undefined && limit > 0) {
					filteredItems = filteredItems.slice(0, limit);
				}

				// Apply compression if requested
				const finalItems = compress
					? compressLib(filteredItems, { compressElements: true })
					: filteredItems;

				await log(
					"info",
					"view_library",
					{ library, itemCount: finalItems.length, compress },
					`Viewed library: ${finalItems.length} items`,
				);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									library: library.endsWith(".excalidrawlib")
										? library
										: `${library}.excalidrawlib`,
									items: finalItems,
									totalItems: finalItems.length,
									originalTotal: libraryData.libraryItems.length,
									compressed: compress,
								},
								null,
								2,
							),
						},
					],
				};
			} catch (error) {
				const errorMsg = `Failed to view library: ${String(error)}`;
				await log("error", "view_library", { library }, errorMsg);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{ success: false, error: errorMsg },
								null,
								2,
							),
						},
					],
				};
			}
		},
	);
};
