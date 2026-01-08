import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "@/config.ts";
import { log } from "@/lib/utils/logger.ts";
import { createNote, deleteNote, updateNote } from "@/lib/utils/notes.ts";
import { resolvePath } from "@/lib/utils/path.ts";

export const registerManageNote = (server: McpServer) => {
	server.registerTool(
		"manage_note",
		{
			description: `${config.systemPrompt}\n\nCreate, update, or delete a specific note.`,
			inputSchema: {
				action: z
					.enum(["create", "update", "delete"])
					.optional()
					.default("create")
					.describe("Action to perform"),
				path: z.string().describe("Relative path from vault root"),
				content: z
					.string()
					.optional()
					.describe("Markdown content (required for create and update)"),
			},
		},
		async ({ action = "create", path, content }) => {
			try {
				if (action === "delete") {
					await deleteNote(path);
					const vaultPath = resolvePath(config.obsidianVault || "");
					const fullPath = `${vaultPath}/${path}`;

					await log(
						"info",
						"manage_note",
						{ action, path },
						`Deleted note: ${path}`,
					);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										success: true,
										message: `Deleted note: ${path}`,
										path: fullPath,
									},
									null,
									2,
								),
							},
						],
					};
				}

				if (action === "create" || action === "update") {
					if (!content) {
						throw new Error(
							"Content is required for create and update actions",
						);
					}

					const notePath =
						action === "create"
							? await createNote(path, content)
							: await updateNote(path, content);

					const message =
						action === "create"
							? `Created note: ${path}`
							: `Updated note: ${path}`;

					await log("info", "manage_note", { action, path }, message);

					const vaultPath = resolvePath(config.obsidianVault || "");
					const fullPath = `${vaultPath}/${notePath}`;

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{ success: true, message, path: fullPath },
									null,
									2,
								),
							},
						],
					};
				}

				throw new Error(`Unknown action: ${action}`);
			} catch (error) {
				const errorMsg = `Failed to ${action} note: ${String(error)}`;
				await log("error", "manage_note", { action, path }, errorMsg);
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
