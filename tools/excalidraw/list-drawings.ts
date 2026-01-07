import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { config } from "@/config.ts";
import { log } from "@/lib/utils/logger.ts";
import { resolvePath } from "@/lib/utils/path.ts";

export const registerListDrawings = (server: McpServer) => {
	server.registerTool(
		"list_drawings",
		{
			description: `${config.systemPrompt}\n\nList all Excalidraw drawing files in the drawings folder. Returns raw data including paths and metadata (title, tags, createdAt) for LLM to parse and format.`,
		},
		async () => {
			const designsDir = resolvePath(config.designsDir);

			try {
				// Ensure designs directory exists
				await Bun.$`mkdir -p ${designsDir}`.quiet();

				const files = await readdir(designsDir, { recursive: true });
				const drawingFiles = files.filter(
					(f) => typeof f === "string" && f.endsWith(".excalidraw"),
				);

				const drawings = await Promise.all(
					drawingFiles.map(async (filename) => {
						const fullPath = resolve(designsDir, filename);
						let metadata: {
							title?: string;
							createdAt?: string;
							tags?: string[];
						} = {};
						try {
							const file = Bun.file(fullPath);
							if (await file.exists()) {
								const content = await file.text();
								const parsed = JSON.parse(content);
								metadata = {
									title: parsed.title,
									createdAt: parsed.createdAt,
									tags: parsed.tags || parsed.metadata?.tags,
								};
							}
						} catch {
							// Ignore parsing errors
						}
						return {
							path: filename,
							filename,
							absolutePath: fullPath,
							...metadata,
						};
					}),
				);

				await log(
					"info",
					"list_drawings",
					{},
					`Listed ${drawings.length} drawings`,
				);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									count: drawings.length,
									drawings,
								},
								null,
								2,
							),
						},
					],
				};
			} catch (error) {
				const errorMsg = `Failed to list drawings: ${String(error)}`;
				await log("error", "list_drawings", {}, errorMsg);

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
