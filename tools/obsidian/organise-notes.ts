import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "@/config.ts";
import { log } from "@/lib/utils/logger.ts";
import {
	moveNote,
	updateProfileReferences,
	updateStateReferences,
} from "@/lib/utils/notes.ts";
import { resolvePath } from "@/lib/utils/path.ts";

export const registerOrganiseNotes = (server: McpServer) => {
	server.registerTool(
		"organise_notes",
		{
			description: `${config.systemPrompt}\n\nMove note files into a subdirectory and update all references in state and profile.`,
			inputSchema: {
				filePaths: z
					.array(z.string())
					.describe("Array of relative note paths from vault root to move"),
				folderName: z
					.string()
					.describe("Target folder name (will be created if it doesn't exist)"),
			},
		},
		async ({ filePaths, folderName }) => {
			try {
				if (!config.obsidianVault) {
					throw new Error("Obsidian vault path not configured");
				}

				const vaultPath = resolvePath(config.obsidianVault);
				const moved: Array<{ oldPath: string; newPath: string }> = [];

				for (const oldPath of filePaths) {
					const filename = oldPath.split("/").pop();
					if (!filename) continue;

					const newPath = `${folderName}/${filename}`;
					const oldFullPath = `${vaultPath}/${oldPath}`;
					const file = Bun.file(oldFullPath);

					if (!(await file.exists())) {
						throw new Error(`Note not found: ${oldPath}`);
					}

					await moveNote(oldPath, newPath);
					await updateStateReferences(oldPath, newPath);
					await updateProfileReferences(oldPath, newPath);
					moved.push({ oldPath, newPath });
				}

				await log(
					"info",
					"organise_notes",
					{ folderName, count: moved.length },
					`Organised ${moved.length} notes into ${folderName}`,
				);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									folderName,
									moved: moved.length,
									paths: moved,
								},
								null,
								2,
							),
						},
					],
				};
			} catch (error) {
				const errorMsg = `Failed to organise notes: ${String(error)}`;
				await log(
					"error",
					"organise_notes",
					{ filePaths, folderName },
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
