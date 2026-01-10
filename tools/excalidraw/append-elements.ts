import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "@/config.ts";
import type { ExcalidrawElement } from "@/lib/utils/excalidraw.ts";
import {
	applyDesignSystemDefaults,
	getElementSummary,
	mergeElements,
	parseDrawingFile,
} from "@/lib/utils/excalidraw.ts";
import { log } from "@/lib/utils/logger.ts";
import { resolvePath } from "@/lib/utils/path.ts";

export const registerAppendElements = (server: McpServer) => {
	server.registerTool(
		"append_elements",
		{
			description: `${config.systemPrompt}\n\nAdd elements to an Excalidraw drawing. Automatically applies design system defaults to elements unless explicitly provided. Elements are merged and IDs are regenerated to ensure uniqueness.`,
			inputSchema: {
				path: z.string().describe("Path to drawing file."),
				elements: z.array(z.any()).describe("Array of element objects to add. Design system defaults will be applied automatically."),
			},
		},
		async ({ path, elements }) => {
			const designsDir = resolvePath(config.designsDir);

			try {
				const filename = path.endsWith(".excalidraw") ? path : `${path}.excalidraw`;
				const fullPath = resolve(designsDir, filename);
				const file = Bun.file(fullPath);

				if (!(await file.exists())) {
					throw new Error(`Drawing not found: ${path}`);
				}

				const content = await file.text();
				const drawing = parseDrawingFile(content);

				const rawElements = elements as unknown as Partial<ExcalidrawElement>[];
				const newElements = await Promise.all(rawElements.map((el) => applyDesignSystemDefaults(el)));
				const mergedElements = mergeElements(drawing.elements, newElements, { regenerateIds: true });
				const updatedDrawing = { ...drawing, elements: mergedElements };

				await Bun.write(fullPath, JSON.stringify(updatedDrawing, null, 2));

				const summary = getElementSummary(newElements);
				await log("info", "append_elements", { path, elementCount: newElements.length }, `Appended ${newElements.length} elements`);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									message: `Appended ${newElements.length} elements`,
									path: fullPath,
									added: { count: newElements.length, summary },
									totalElements: mergedElements.length,
								},
								null,
								2,
							),
						},
					],
				};
			} catch (error) {
				const errorMsg = `Failed to append elements: ${String(error)}`;
				await log("error", "append_elements", { path }, errorMsg);
				return {
					content: [{ type: "text", text: JSON.stringify({ success: false, error: errorMsg }, null, 2) }],
				};
			}
		},
	);
};
