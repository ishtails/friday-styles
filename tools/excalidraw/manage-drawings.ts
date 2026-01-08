import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "@/config.ts";
import type { ExcalidrawElement } from "@/lib/utils/excalidraw.ts";
import {
	getElementSummary,
	mergeElements,
	parseDrawingFile,
} from "@/lib/utils/excalidraw.ts";
import { log } from "@/lib/utils/logger.ts";
import { resolvePath } from "@/lib/utils/path.ts";

export const registerManageDrawings = (server: McpServer) => {
	server.registerTool(
		"manage_drawings",
		{
			description: `${config.systemPrompt}\n\nManage Excalidraw drawings: create new file with basic structure, delete file, append/remove/update elements incrementally, or read elements with flexible granularity (summary, full, byIds, byRange).`,
			inputSchema: {
				action: z
					.enum(["create", "delete", "append", "read", "remove", "update"])
					.describe(
						"Action: create, delete, append/remove/update elements, or read elements",
					),
				path: z
					.string()
					.optional()
					.describe(
						"Path to drawing file. Optional for create, required for others.",
					),
				title: z
					.string()
					.optional()
					.describe(
						"Title for new drawing (used to generate filename if path not provided).",
					),
				overwrite: z
					.boolean()
					.optional()
					.default(false)
					.describe("Whether to overwrite existing file. Defaults to false."),
				elements: z
					.array(z.any())
					.optional()
					.describe(
						"Array of element objects to append (required for 'append' action)",
					),
				elementUpdates: z
					.array(z.any())
					.optional()
					.describe(
						"Array of partial element objects with 'id' field to update (required for 'update' action)",
					),
				regenerateIds: z
					.boolean()
					.optional()
					.default(true)
					.describe(
						"Whether to regenerate element IDs for append. Defaults to true.",
					),
				mode: z
					.enum(["summary", "full", "byIds", "byRange"])
					.optional()
					.describe(
						"Read mode: 'summary', 'full', 'byIds', or 'byRange' (required for 'read' action)",
					),
				elementIds: z
					.array(z.string())
					.optional()
					.describe(
						"Element IDs to read/remove (required for 'byIds' mode or 'remove' action)",
					),
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
		async ({
			action,
			path,
			title,
			overwrite = false,
			elements,
			elementUpdates,
			regenerateIds = true,
			mode,
			elementIds,
			startIndex,
			endIndex,
		}) => {
			const designsDir = resolvePath(config.designsDir);

			try {
				await Bun.$`mkdir -p ${designsDir}`.quiet();

				if (action === "delete") {
					if (!path) throw new Error("Path is required for delete action");
					const filename = path.endsWith(".excalidraw")
						? path
						: `${path}.excalidraw`;
					const fullPath = resolve(designsDir, filename);
					const file = Bun.file(fullPath);
					if (!(await file.exists()))
						throw new Error(`Drawing not found: ${path}`);
					await Bun.$`rm ${fullPath}`.quiet();
					await log(
						"info",
						"manage_drawings",
						{ action, path },
						`Deleted: ${fullPath}`,
					);
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										success: true,
										message: `Deleted: ${path}`,
										path: fullPath,
									},
									null,
									2,
								),
							},
						],
					};
				}

				if (action === "create") {
					let fullPath: string;
					let filename: string;

					if (path) {
						filename = path.endsWith(".excalidraw")
							? path
							: `${path}.excalidraw`;
						fullPath = resolve(designsDir, filename);
					} else if (title) {
						const now = new Date();
						const monthAbbrevs = [
							"jan",
							"feb",
							"mar",
							"apr",
							"may",
							"jun",
							"jul",
							"aug",
							"sep",
							"oct",
							"nov",
							"dec",
						] as const;
						const month = monthAbbrevs[now.getMonth()];
						const day = `${now.getDate()}`.padStart(2, "0");
						const year = `${now.getFullYear()}`.slice(-2);
						const datePrefix = `${month}${day}${year}`;
						const safeTitle =
							title
								.trim()
								.toLowerCase()
								.replace(/[^a-z0-9]+/g, "-")
								.replace(/^-+|-+$/g, "") || "untitled";
						filename = `${safeTitle}.excalidraw`;
						fullPath = resolve(designsDir, filename);

						if (!overwrite) {
							let counter = 1;
							while (await Bun.file(fullPath).exists()) {
								filename = `${datePrefix}-${safeTitle}-${counter}.excalidraw`;
								fullPath = resolve(designsDir, filename);
								counter += 1;
							}
						}
					} else {
						throw new Error(
							"Either path or title must be provided for create action",
						);
					}

					const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
					await Bun.$`mkdir -p ${dir}`.quiet();

					const drawing = {
						type: "excalidraw",
						version: 2,
						source: "friday-mcp",
						title: title || path?.replace(".excalidraw", "") || "Untitled",
						createdAt: new Date().toISOString(),
						elements: [],
					};

					await Bun.write(fullPath, JSON.stringify(drawing, null, 2));
					await log(
						"info",
						"manage_drawings",
						{ action, path, title },
						`Created: ${filename}`,
					);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										success: true,
										message: `Created: ${filename}`,
										filename,
										absolutePath: fullPath,
										designsDir,
									},
									null,
									2,
								),
							},
						],
					};
				}

				if (
					action === "append" ||
					action === "read" ||
					action === "remove" ||
					action === "update"
				) {
					if (!path)
						throw new Error(
							"Path is required for append/read/remove/update actions",
						);
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

					if (action === "append") {
						if (!elements || elements.length === 0) {
							throw new Error("elements array is required for append action");
						}

						const newElements = elements as unknown as ExcalidrawElement[];
						const mergedElements = mergeElements(
							drawing.elements,
							newElements,
							{ regenerateIds },
						);
						const updatedDrawing = { ...drawing, elements: mergedElements };

						await Bun.write(fullPath, JSON.stringify(updatedDrawing, null, 2));

						const summary = getElementSummary(newElements);
						await log(
							"info",
							"manage_drawings",
							{ action, path, elementCount: newElements.length },
							`Appended ${newElements.length} elements`,
						);

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
					}

					if (action === "read") {
						if (!mode) throw new Error("mode is required for read action");

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
							"manage_drawings",
							{ action, path, mode },
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
					}

					if (action === "remove") {
						if (!elementIds || elementIds.length === 0) {
							throw new Error("elementIds array is required for remove action");
						}

						const idSet = new Set(elementIds);
						const filteredElements = drawing.elements.filter(
							(el) => !idSet.has(el.id),
						);
						const removedCount =
							drawing.elements.length - filteredElements.length;

						if (removedCount === 0) {
							throw new Error(
								`No elements found with provided IDs: ${elementIds.join(", ")}`,
							);
						}

						const updatedDrawing = { ...drawing, elements: filteredElements };
						await Bun.write(fullPath, JSON.stringify(updatedDrawing, null, 2));

						await log(
							"info",
							"manage_drawings",
							{ action, path, removedCount },
							`Removed ${removedCount} elements`,
						);

						return {
							content: [
								{
									type: "text",
									text: JSON.stringify(
										{
											success: true,
											message: `Removed ${removedCount} elements`,
											path: fullPath,
											removed: { count: removedCount, elementIds },
											totalElements: filteredElements.length,
										},
										null,
										2,
									),
								},
							],
						};
					}

					if (action === "update") {
						if (!elementUpdates || elementUpdates.length === 0) {
							throw new Error(
								"elementUpdates array is required for update action",
							);
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
							"manage_drawings",
							{ action, path, updatedCount },
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
					}
				}

				throw new Error(`Unknown action: ${action}`);
			} catch (error) {
				const errorMsg = `Failed to ${action} drawing: ${String(error)}`;
				await log(
					"error",
					"manage_drawings",
					{ action, path, title },
					errorMsg,
				);
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
