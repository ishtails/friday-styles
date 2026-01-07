import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { log } from "@/lib/utils/logger.ts";

export const registerListShortcuts = (server: McpServer) => {
	server.registerTool(
		"list_shortcuts",
		{
			description: "List Apple Shortcuts",
			inputSchema: {
				folder: z.string().optional(),
				listFolders: z.boolean().optional(),
			},
		},
		async ({ folder, listFolders }) => {
			try {
				// Build command arguments
				const args = ["shortcuts", "list"];
				if (listFolders) {
					args.push("--folders");
				} else if (folder) {
					args.push("-f", folder);
				}

				// Use Bun.spawn to explicitly capture stdout/stderr
				const proc = Bun.spawn(args, {
					stdout: "pipe",
					stderr: "pipe",
				});

				const [stdout, stderr, exitCode] = await Promise.all([
					new Response(proc.stdout).text(),
					new Response(proc.stderr).text(),
					proc.exited,
				]);

				if (exitCode !== 0) {
					throw new Error(stderr || "Command failed");
				}

				const output = stdout.trim() || "";
				const items = output.split("\n").filter((line) => line.trim());

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									count: items.length,
									items,
									folder: folder || undefined,
									listFolders: listFolders || false,
								},
								null,
								2,
							),
						},
					],
				};
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				await log("error", "list_shortcuts", { folder, listFolders }, errorMessage);

				// Check for permission issues
				const isPermissionError = errorMessage.includes("Couldn't communicate with a helper application") ||
					errorMessage.includes("helper application");

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: false,
									error: isPermissionError
										? `${errorMessage}\n\nHint: Ensure Cursor has Automation permissions in System Settings > Privacy & Security > Automation.`
										: errorMessage,
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
