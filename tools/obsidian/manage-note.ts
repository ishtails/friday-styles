import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "@/config.ts";
import { log } from "@/lib/utils/logger.ts";
import { generateNotePath, writeNote, deleteNote } from "@/lib/utils/notes.ts";
import { resolvePath } from "@/lib/utils/path.ts";

export const registerManageNote = (server: McpServer) => {
	server.registerTool(
		"manage_note",
		{
			description: `${config.systemPrompt}\n\nCreate, update, or delete a specific note. Title parameter is mandatory and will be used to generate a readable filename. Filenames follow format: {slugified-title}.md. All notes are stored flat in the notes folder (no subfolders, no refs folder).`,
			inputSchema: {
				action: z
					.enum(["create", "update", "delete"])
					.optional()
					.default("create")
					.describe("Action to perform"),
				title: z.string().describe("Note title (required, used to generate filename)"),
				path: z
					.string()
					.optional()
					.describe("Relative path from vault root (optional, generated from title if not provided)"),
				content: z
					.string()
					.optional()
					.describe("Markdown content (required for create and update)"),
			},
		},
		async ({ action = "create", title, path, content }) => {
			try {
				if (action === "delete") {
					if (!path) {
						throw new Error("Path is required for delete action");
					}
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

					const notePath = path || (await generateNotePath(title));
					await writeNote(notePath, content);

					const message =
						action === "create"
							? `Created note: ${notePath}`
							: `Updated note: ${notePath}`;

					await log("info", "manage_note", { action, path: notePath }, message);

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
