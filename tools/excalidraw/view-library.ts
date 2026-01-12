import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "@/config.ts";
import type { ExcalidrawElement } from "@/lib/utils/excalidraw.ts";
import {
	parseLibraryFile,
	resolveLibraryPath,
} from "@/lib/utils/excalidraw.ts";
import { log } from "@/lib/utils/logger.ts";

export const registerViewLibrary = (server: McpServer) => {
	server.registerTool(
		"view_library",
		{
			description: `${config.systemPrompt}\n\nView elements from a specific library file. Returns paginated elements array (10 elements per page). All library items are flattened into a single elements array.`,
			inputSchema: {
				library: z
					.string()
					.describe(
						"Library filename (with or without .excalidrawlib extension). Use list_libraries to see available libraries.",
					),
				page: z
					.number()
					.optional()
					.default(1)
					.describe("Page number (default: 1, 10 elements per page)"),
			},
		},
		async ({ library, page = 1 }) => {
			try {
				const fullPath = resolveLibraryPath(library);
				const file = Bun.file(fullPath);

				if (!(await file.exists())) {
					throw new Error(`Library not found: ${library}`);
				}

				const content = await file.text();
				const libraryData = parseLibraryFile(content);

				// Flatten all library items into single elements array
				const allElements: ExcalidrawElement[] = [];
				for (const item of libraryData.libraryItems) {
					allElements.push(...(item.elements as ExcalidrawElement[]));
				}

				// Pagination
				const pageSize = 10;
				const totalElements = allElements.length;
				const totalPages = Math.ceil(totalElements / pageSize);
				const startIndex = (page - 1) * pageSize;
				const endIndex = startIndex + pageSize;
				const paginatedElements = allElements.slice(startIndex, endIndex);

				await log(
					"info",
					"view_library",
					{ library, page, elementCount: paginatedElements.length },
					`Viewed library: page ${page}/${totalPages}`,
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
									elements: paginatedElements,
									pagination: {
										currentPage: page,
										pageSize,
										totalElements,
										totalPages,
									},
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
