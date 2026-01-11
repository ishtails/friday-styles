import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "@/config.ts";
import type { ExcalidrawElement } from "@/lib/utils/excalidraw.ts";
import { parseDrawingFile } from "@/lib/utils/excalidraw.ts";
import { log } from "@/lib/utils/logger.ts";
import { resolvePath } from "@/lib/utils/path.ts";

export const registerUpdateElements = (server: McpServer) => {
	server.registerTool(
		"update_elements",
		{
			description: `${config.systemPrompt}\n\nUpdate existing elements in an Excalidraw drawing by ID. Provide partial element objects with 'id' field. Only specified properties will be updated.`,
			inputSchema: {
				path: z.string().describe("Path to drawing file."),
				elementUpdates: z
					.array(z.any())
					.describe(
						"Array of partial element objects with 'id' field to update. Only specified properties will be updated.",
					),
			},
		},
		async ({ path, elementUpdates }) => {
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

				if (!elementUpdates || elementUpdates.length === 0) {
					throw new Error("elementUpdates array is required");
				}

				const updates = elementUpdates as unknown as Array<
					Partial<ExcalidrawElement> & { id: string }
				>;
				const idToUpdate = new Map(
					updates.map((update) => [update.id, update]),
				);

				const updatedElements = drawing.elements.map((el) => {
					const update = idToUpdate.get(el.id);
					if (update) {
						const { id: _id, ...updateData } = update;
						return { ...el, ...updateData, id: el.id };
					}
					return el;
				});

				const updatedCount = Array.from(idToUpdate.keys()).filter((id) =>
					drawing.elements.some((el) => el.id === id),
				).length;

				if (updatedCount === 0) {
					throw new Error(
						`No elements found with provided IDs: ${updates.map((u) => u.id).join(", ")}`,
					);
				}

				const updatedDrawing = { ...drawing, elements: updatedElements };
				await Bun.write(fullPath, JSON.stringify(updatedDrawing, null, 2));

				await log(
					"info",
					"update_elements",
					{ path, updatedCount },
					`Updated ${updatedCount} elements`,
				);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									message: `Updated ${updatedCount} elements`,
									path: fullPath,
									updated: { count: updatedCount },
									totalElements: updatedElements.length,
								},
								null,
								2,
							),
						},
					],
				};
			} catch (error) {
				const errorMsg = `Failed to update elements: ${String(error)}`;
				await log("error", "update_elements", { path }, errorMsg);
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
