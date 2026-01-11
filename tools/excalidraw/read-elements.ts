import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "@/config.ts";
import { getElementSummary, parseDrawingFile } from "@/lib/utils/excalidraw.ts";
import { log } from "@/lib/utils/logger.ts";
import { resolvePath } from "@/lib/utils/path.ts";

export const registerReadElements = (server: McpServer) => {
	server.registerTool(
		"read_elements",
		{
			description: `${config.systemPrompt}\n\nRead elements from an Excalidraw drawing with flexible granularity. Use 'summary' for statistics, 'full' for all elements, 'byIds' for specific elements, or 'byRange' for index range.`,
			inputSchema: {
				path: z.string().describe("Path to drawing file."),
				mode: z
					.enum(["summary", "full", "byIds", "byRange"])
					.describe(
						"Read mode: 'summary' for statistics, 'full' for all elements, 'byIds' for specific elements, 'byRange' for index range.",
					),
				elementIds: z
					.array(z.string())
					.optional()
					.describe("Element IDs to read (required for 'byIds' mode)"),
				startIndex: z
					.number()
					.optional()
					.describe("Start index for range read (required for 'byRange' mode)"),
				endIndex: z
					.number()
					.optional()
					.describe("End index for range read (required for 'byRange' mode)"),
			},
		},
		async ({ path, mode, elementIds, startIndex, endIndex }) => {
			const designsDir = resolvePath(config.designsDir);

			try {
				const filename = path.endsWith(".excalidraw")
					? path
					: `${path}.excalidraw`;
				const fullPath = resolve(designsDir, filename);
				const file = Bun.file(fullPath);

				if (!(await file.exists())) {
					throw new Error(`Drawing not found: ${path}`);
				}

				const content = await file.text();
				const drawing = parseDrawingFile(content);
				const elements = drawing.elements;
				let result: Record<string, unknown>;

				switch (mode) {
					case "summary": {
						result = {
							summary: getElementSummary(elements),
							totalElements: elements.length,
						};
						break;
					}
					case "full": {
						result = { elements, totalElements: elements.length };
						break;
					}
					case "byIds": {
						if (!elementIds || elementIds.length === 0)
							throw new Error("elementIds is required for 'byIds' mode");
						const idSet = new Set(elementIds);
						const filtered = elements.filter((el) => idSet.has(el.id));
						result = {
							elements: filtered,
							found: filtered.length,
							requested: elementIds.length,
						};
						break;
					}
					case "byRange": {
						if (startIndex === undefined || endIndex === undefined) {
							throw new Error(
								"startIndex and endIndex are required for 'byRange' mode",
							);
						}
						const start = Math.max(0, startIndex);
						const end = Math.min(elements.length, endIndex);
						const sliced = elements.slice(start, end);
						result = {
							elements: sliced,
							range: { start, end },
							totalElements: elements.length,
						};
						break;
					}
				}

				await log(
					"info",
					"read_elements",
					{ path, mode },
					`Read elements (mode: ${mode})`,
				);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{ success: true, path: fullPath, ...result } as Record<
									string,
									unknown
								>,
								null,
								2,
							),
						},
					],
				};
			} catch (error) {
				const errorMsg = `Failed to read elements: ${String(error)}`;
				await log("error", "read_elements", { path, mode }, errorMsg);
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
