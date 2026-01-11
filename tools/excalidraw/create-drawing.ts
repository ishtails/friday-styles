import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "@/config.ts";
import { resolvePath } from "@/lib/utils/path.ts";
import { respond } from "@/lib/utils/respond.ts";
import { verify } from "@/lib/utils/verification.ts";

export const registerCreateDrawing = (server: McpServer) => {
	server.registerTool(
		"create_drawing",
		{
			description: `${config.systemPrompt}\n\nCreate a new Excalidraw drawing file with minimal structure. Returns the file path for use with other drawing tools.`,
			inputSchema: {
				path: z
					.string()
					.optional()
					.describe(
						"Path to drawing file. Optional - filename will be generated from title if not provided.",
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
			},
		},
		async ({ path, title, overwrite = false }) => {
			const designsDir = resolvePath(config.designsDir);
			const params = { path, title, overwrite };

			try {
				await Bun.$`mkdir -p ${designsDir}`.quiet();

				let fullPath: string;
				let filename: string;

				if (path) {
					filename = path.endsWith(".excalidraw") ? path : `${path}.excalidraw`;
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
					throw new Error("Either path or title must be provided");
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

				const verification = await verify.fileWrite(fullPath, {
					title: drawing.title,
					type: drawing.type,
				});

				return respond.ok(
					{ filename, path: fullPath, designsDir },
					`Created: ${filename}`,
					{ toolName: "create_drawing", params, verification },
				);
			} catch (error) {
				return respond.err(error instanceof Error ? error : String(error), {
					toolName: "create_drawing",
					params,
				});
			}
		},
	);
};
