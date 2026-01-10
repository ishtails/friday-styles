import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "@/config.ts";
import { log } from "@/lib/utils/logger.ts";
import { resolvePath } from "@/lib/utils/path.ts";

export const registerDeleteDrawing = (server: McpServer) => {
	server.registerTool(
		"delete_drawing",
		{
			description: `${config.systemPrompt}\n\nDelete an entire Excalidraw drawing file.`,
			inputSchema: {
				path: z.string().describe("Path to drawing file to delete."),
			},
		},
		async ({ path }) => {
			const designsDir = resolvePath(config.designsDir);

			try {
				const filename = path.endsWith(".excalidraw") ? path : `${path}.excalidraw`;
				const fullPath = resolve(designsDir, filename);
				const file = Bun.file(fullPath);

				if (!(await file.exists())) {
					throw new Error(`Drawing not found: ${path}`);
				}

				await Bun.$`rm ${fullPath}`.quiet();
				await log("info", "delete_drawing", { path }, `Deleted: ${fullPath}`);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ success: true, message: `Deleted: ${path}`, path: fullPath }, null, 2),
						},
					],
				};
			} catch (error) {
				const errorMsg = `Failed to delete drawing: ${String(error)}`;
				await log("error", "delete_drawing", { path }, errorMsg);
				return {
					content: [{ type: "text", text: JSON.stringify({ success: false, error: errorMsg }, null, 2) }],
				};
			}
		},
	);
};
