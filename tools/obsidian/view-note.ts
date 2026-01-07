import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "@/config.ts";
import { log } from "@/lib/utils/logger.ts";
import { resolvePath } from "@/lib/utils/path.ts";

export const registerViewNote = (server: McpServer) => {
	server.registerTool(
		"view_note",
		{
			description: `${config.systemPrompt}\n\nSee the content of a specific note.`,
			inputSchema: {
				path: z.string().describe("Relative path from vault root"),
			},
		},
		async ({ path }) => {
			try {
				if (!config.obsidianVault) {
					throw new Error("Obsidian vault path not configured");
				}

				const vaultPath = resolvePath(config.obsidianVault);
				const fullPath = `${vaultPath}/${path}`;

				const file = Bun.file(fullPath);
				if (!(await file.exists())) {
					throw new Error(`Note not found: ${path}`);
				}

				const content = await file.text();

				await log("info", "view_note", { path }, `Viewed note: ${path}`);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{ success: true, path, absolutePath: fullPath, content },
								null,
								2,
							),
						},
					],
				};
			} catch (error) {
				const errorMsg = `Failed to view note: ${String(error)}`;
				await log("error", "view_note", { path }, errorMsg);
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
