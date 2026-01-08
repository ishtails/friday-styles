import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "@/config.ts";
import {
	parseLibraryFile,
	resolveLibraryPath,
} from "@/lib/utils/excalidraw-libs.ts";
import { log } from "@/lib/utils/logger.ts";

export const registerViewLibrary = (server: McpServer) => {
	server.registerTool(
		"view_library",
		{
			description: `${config.systemPrompt}\n\nView the complete content of a specific library file. Returns all library items with their full element arrays. This shows you every component available in the library so you can see what components exist, understand their structure and properties, decide which components to use for your drawing, and extract specific elements you need. Libraries are also available as MCP resources at ${config.serverName}://library/{name}. After viewing, extract the elements you want and include them in your drawing JSON when using manage_drawings.`,
			inputSchema: {
				library: z
					.string()
					.describe(
						"Library filename (with or without .excalidrawlib extension). Use list_libraries to see available libraries.",
					),
			},
		},
		async ({ library }) => {
			try {
				const fullPath = resolveLibraryPath(library);
				const file = Bun.file(fullPath);

				if (!(await file.exists())) {
					throw new Error(`Library not found: ${library}`);
				}

				const content = await file.text();
				const libraryData = parseLibraryFile(content);

				await log("info", "view_library", { library }, "Viewed library");

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
									type: libraryData.type,
									version: libraryData.version,
									source: libraryData.source,
									items: libraryData.libraryItems,
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
