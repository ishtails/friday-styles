import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { config } from "@/config.ts";
import {
	getLibraryMetadata,
	parseLibraryFile,
} from "@/lib/utils/excalidraw.ts";
import { log } from "@/lib/utils/logger.ts";
import { resolvePath } from "@/lib/utils/path.ts";

export const registerListLibraries = (server: McpServer) => {
	server.registerTool(
		"list_libraries",
		{
			description: `${config.systemPrompt}\n\nDiscover available Excalidraw libraries. Returns library names, descriptions, item counts, and item names. Libraries are also available as MCP resources at ${config.serverName}://library/{name}. Use this first to find libraries that might be relevant for your drawing purpose.`,
		},
		async () => {
			const librariesDir = resolvePath(config.librariesDir);

			try {
				await Bun.$`mkdir -p ${librariesDir}`.quiet();

				const files = await readdir(librariesDir, { recursive: true });
				const libraryFiles = files.filter(
					(f) => typeof f === "string" && f.endsWith(".excalidrawlib"),
				);

				const libraries = await Promise.all(
					libraryFiles.map(async (filename) => {
						const fullPath = resolve(librariesDir, filename);
						try {
							const file = Bun.file(fullPath);
							if (await file.exists()) {
								const content = await file.text();
								const library = parseLibraryFile(content);
								const metadata = getLibraryMetadata(library);
								return {
									filename,
									name: filename.replace(".excalidrawlib", ""),
									...metadata,
								};
							}
						} catch {
							// Ignore parsing errors
						}
						return {
							filename,
							name: filename.replace(".excalidrawlib", ""),
							description: "",
							itemCount: 0,
							itemNames: [],
							version: 0,
						};
					}),
				);

				await log(
					"info",
					"list_libraries",
					{},
					`Listed ${libraries.length} libraries`,
				);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									count: libraries.length,
									libraries,
								},
								null,
								2,
							),
						},
					],
				};
			} catch (error) {
				const errorMsg = `Failed to list libraries: ${String(error)}`;
				await log("error", "list_libraries", {}, errorMsg);

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
