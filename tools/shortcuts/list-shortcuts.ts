import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { log } from "@/lib/utils/logger.ts";

export const registerListShortcuts = (server: McpServer) => {
	server.registerTool(
		"list_shortcuts",
		{
			description:
				"List Apple Shortcuts and folders. Can list all shortcuts, shortcuts in a specific folder, or all folders.",
			inputSchema: {
				folder: z
					.string()
					.optional()
					.describe(
						"Optional folder name to list shortcuts from. If not provided, lists all shortcuts.",
					),
				listFolders: z
					.boolean()
					.optional()
					.describe("If true, lists all folders instead of shortcuts."),
			},
		},
		async ({ folder, listFolders }) => {
			try {
				// Build command arguments array
				const args: string[] = ["list"];

				if (listFolders) {
					// List all folders
					args.push("--folders");
				} else if (folder) {
					// List shortcuts in specific folder
					args.push("-f", folder);
				}

				// Execute the shortcut command using spawn for better control
				const proc = Bun.spawn(["/usr/bin/shortcuts", ...args], {
					stdout: "pipe",
					stderr: "pipe",
				});

				const [stdout, stderr, exitCode] = await Promise.all([
					new Response(proc.stdout).arrayBuffer(),
					new Response(proc.stderr).arrayBuffer(),
					proc.exited,
				]);

				const stderrText = Buffer.from(stderr).toString();

				// Check if command failed
				if (exitCode !== 0) {
					throw new Error(
						`shortcuts command failed with exit code ${exitCode}: ${stderrText || "Unknown error"}`,
					);
				}

				const output = Buffer.from(stdout).toString().trim();
				const lines = output.split("\n").filter((line) => line.trim());

				await log(
					"info",
					"list_shortcuts",
					{ folder, listFolders, count: lines.length },
					`Listed ${listFolders ? "folders" : "shortcuts"}${folder ? ` in folder: ${folder}` : ""}`,
				);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									type: listFolders ? "folders" : "shortcuts",
									folder: folder || null,
									count: lines.length,
									items: lines,
									raw: output,
								},
								null,
								2,
							),
						},
					],
				};
			} catch (error) {
				const errorDetails =
					error instanceof Error ? error.message : String(error);
				const errorMsg = `Failed to list shortcuts: ${errorDetails}`;

				await log(
					"error",
					"list_shortcuts",
					{ folder, listFolders, error: errorDetails },
					errorMsg,
				);

				// Provide helpful error message about permissions if it's a helper communication error
				const isPermissionError =
					errorDetails.includes(
						"Couldn't communicate with a helper application",
					) || errorDetails.includes("helper application");

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: false,
									error: errorMsg,
									hint: isPermissionError
										? "This may be a macOS permissions issue. Ensure Cursor has Automation permissions in System Settings > Privacy & Security > Automation."
										: undefined,
								},
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
