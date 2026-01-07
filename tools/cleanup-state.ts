import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "@/config.ts";
import { type CleanupOptions, cleanupState } from "@/lib/utils/cleanup.ts";
import { log } from "@/lib/utils/logger.ts";

export const registerCleanupState = (server: McpServer) => {
	server.registerTool(
		"cleanup_state",
		{
			description: `${config.systemPrompt}\n\nClean up state.yaml by removing outdated goals and ideas based on configurable criteria. Creates timestamped backups for state and changelog, then resets changelog.`,
			inputSchema: {
				removeCompletedGoals: z.boolean().optional(),
				removeArchivedGoals: z.boolean().optional(),
				removeExpiredGoals: z.boolean().optional(),
				removePausedGoals: z.boolean().optional(),
				goalAgeThreshold: z.number().optional(),
				removeCompletedIdeas: z.boolean().optional(),
				removeArchivedIdeas: z.boolean().optional(),
				ideaAgeThreshold: z.number().optional(),
				preset: z.enum(["aggressive", "conservative", "custom"]).optional(),
			},
		},
		async (options: CleanupOptions) => {
			try {
				const summary = await cleanupState(options);
				const message = `Cleaned up state: removed ${summary.goalsRemoved} goal(s) and ${summary.ideasRemoved} idea(s). State backup: ${summary.backupPath}, Changelog backup: ${summary.changelogBackupPath}`;

				await log("info", "cleanup_state", options, message);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									message,
									backupPath: summary.backupPath,
									changelogBackupPath: summary.changelogBackupPath,
									goalsRemoved: summary.goalsRemoved,
									ideasRemoved: summary.ideasRemoved,
								},
								null,
								2,
							),
						},
					],
				};
			} catch (error) {
				const errorMsg = `Failed to cleanup state: ${String(error)}`;
				await log("error", "cleanup_state", options, errorMsg);
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
