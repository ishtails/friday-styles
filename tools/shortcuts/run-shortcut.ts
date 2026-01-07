import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { log } from "@/lib/utils/logger.ts";

export const registerRunShortcut = (server: McpServer) => {
	server.registerTool(
		"run_shortcut",
		{
			description: "Run an Apple Shortcut",
			inputSchema: {
				shortcutName: z.string(),
				inputText: z.string().optional(),
			},
		},
		async ({ shortcutName, inputText }) => {
			try {
				const args = ["shortcuts", "run", shortcutName];
				if (inputText) {
					args.push("-i", inputText);
				}

				const result = await Bun.$`${args}`.quiet();

				if (result.exitCode !== 0) {
					throw new Error(result.stderr?.toString() || "Command failed");
				}

				return {
					content: [{ type: "text", text: result.stdout?.toString() || "" }],
				};
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				await log("error", "run_shortcut", { shortcutName, inputText }, errorMessage);

				// Check for permission issues
				const isPermissionError = errorMessage.includes("Couldn't communicate with a helper application") ||
					errorMessage.includes("helper application");

				return {
					content: [
						{
							type: "text",
							text: isPermissionError
								? `${errorMessage}\n\nHint: Ensure Cursor has Automation permissions in System Settings > Privacy & Security > Automation.`
								: errorMessage,
						},
					],
				};
			}
		},
	);
};
