import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "@/config.ts";
import {
	createEvent,
	deleteEvent,
	type Event,
	updateEvent,
} from "@/lib/utils/calendar.ts";
import { log } from "@/lib/utils/logger.ts";

export const registerManageCalendarEvent = (server: McpServer) => {
	server.registerTool(
		"manage_event",
		{
			description: `${config.systemPrompt}\n\nCreate, update, or delete events in Google Calendar. Times must be in format "DD-MM-YYYY HH-MM" (e.g., "01-01-2024 14-00"). Timezone conversion happens automatically.`,
			inputSchema: {
				action: z
					.enum(["create", "update", "delete"])
					.describe("Action to perform: create, update, or delete"),
				eventId: z
					.string()
					.optional()
					.describe("Event ID (required for update and delete operations)"),
				title: z
					.string()
					.optional()
					.describe("Event title/summary (required for create and update)"),
				startTime: z
					.string()
					.optional()
					.describe(
						'Start time in format "DD-MM-YYYY HH-MM" (e.g., "01-01-2024 14-00"). Required for create and update.',
					),
				endTime: z
					.string()
					.optional()
					.describe(
						'End time in format "DD-MM-YYYY HH-MM", or duration like "1h", "90m". Defaults to 1 hour after start.',
					),
				timezone: z
					.string()
					.optional()
					.describe(
						"Override timezone (defaults to configured timezone). Use IANA timezone names like 'America/New_York'.",
					),
				description: z.string().optional().describe("Event description"),
				sendUpdates: z
					.enum(["all", "externalOnly", "none"])
					.optional()
					.default("none")
					.describe(
						"Whether to send notifications about the event deletion. Defaults to 'none'.",
					),
			},
		},
		async ({
			action,
			eventId,
			title,
			startTime,
			endTime,
			timezone,
			description,
			sendUpdates = "none",
		}) => {
			try {
				const tz = timezone || config.timezone;
				let response: {
					success: boolean;
					message: string;
					event?: Event;
					eventLink?: string;
				};

				switch (action) {
					case "create": {
						if (!title || !startTime) {
							throw new Error(
								"Title and startTime are required for creating events",
							);
						}

						const result = await createEvent({
							title,
							description,
							startTime,
							endTime,
							timezone: tz,
						});

						response = {
							success: true,
							message: `Created calendar event: ${title}`,
							event: result.event,
							eventLink: result.htmlLink,
						};
						break;
					}

					case "update": {
						if (!eventId) {
							throw new Error("eventId is required for updating events");
						}

						const result = await updateEvent({
							eventId,
							title,
							description,
							startTime,
							endTime,
							timezone: tz,
						});

						const eventSummary = result.event.summary || title || "event";

						response = {
							success: true,
							message: `Updated calendar event: ${eventSummary}`,
							event: result.event,
							eventLink: result.htmlLink,
						};
						break;
					}

					case "delete": {
						if (!eventId) {
							throw new Error("eventId is required for deleting events");
						}

						const result = await deleteEvent({
							eventId,
							sendUpdates,
						});

						let deleteMessage = "Deleted calendar event";
						if (result.isRecurringMaster) {
							deleteMessage = "Deleted recurring event series (all instances)";
						} else if (result.isRecurring) {
							deleteMessage = "Deleted single instance of recurring event";
						}

						response = {
							success: true,
							message: deleteMessage,
						};
						break;
					}

					default:
						throw new Error(`Unknown action: ${action}`);
				}

				await log(
					"info",
					"manage_calendar_event",
					{ action, eventId, title, startTime, endTime, timezone: tz },
					response.message,
				);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(response, null, 2),
						},
					],
				};
			} catch (error) {
				const msg = error instanceof Error ? error.message : "Unknown error";
				await log(
					"error",
					"manage_calendar_event",
					{ action, eventId, title, startTime, endTime, timezone },
					msg,
				);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: false,
									error: `Error managing calendar event: ${msg}`,
								},
								null,
								2,
							),
						},
					],
					isError: true,
				};
			}
		},
	);
};
