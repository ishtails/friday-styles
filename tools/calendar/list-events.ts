import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { google } from "googleapis";
import { z } from "zod";
import { config } from "@/config.ts";
import { getAuthenticatedClient } from "@/lib/utils/google-auth.ts";
import { log } from "@/lib/utils/logger.ts";
import { getState } from "@/lib/utils/state.ts";

export const registerListEvents = (server: McpServer) => {
	server.registerTool(
		"list_events",
		{
			description: `${config.systemPrompt}\n\nGets upcoming calendar events and current goals from state. Returns raw data for LLM to parse and present.`,
			inputSchema: {
				days: z
					.number()
					.optional()
					.default(30)
					.describe("Number of days ahead to check (default: 30)"),
			},
		},
		async ({ days = 30 }) => {
			try {
				const calendar = google.calendar({
					version: "v3",
					auth: await getAuthenticatedClient(),
				});
				const state = await getState();
				const timeMax = new Date(Date.now() + days * 86_400_000).toISOString();

				const calendarResponse = await calendar.events.list({
					calendarId: "primary",
					timeMin: new Date().toISOString(),
					timeMax,
					singleEvents: true,
					orderBy: "startTime",
					maxResults: 50,
				});

				const events = calendarResponse.data.items || [];
				const goals = state.data.goals || [];

				const result = {
					calendar_events: events,
					state_goals: goals,
					time_range: {
						from: new Date().toISOString(),
						to: timeMax,
						days_ahead: days,
					},
				};

				await log(
					"info",
					"check_schedule",
					{ days },
					`Retrieved ${events.length} calendar events and ${goals.length} goals`,
				);
				return {
					content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				};
			} catch (error) {
				const msg = error instanceof Error ? error.message : "Unknown error";
				await log("error", "check_schedule", { days }, msg);
				return {
					content: [{ type: "text", text: `Error checking schedule: ${msg}` }],
					isError: true,
				};
			}
		},
	);
};
