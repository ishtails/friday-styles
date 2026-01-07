import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { google } from "googleapis";
import { z } from "zod";
import { config } from "@/config.ts";
import {
	convertToGoogleCalendarFormat,
	parseDuration,
	parseLocalTime,
	validateEventTimes,
	validateNotInPast,
} from "@/lib/utils/datetime.ts";
import { getAuthenticatedClient } from "@/lib/utils/google-auth.ts";
import { log } from "@/lib/utils/logger.ts";

export const registerManageCalendarEvent = (server: McpServer) => {
	server.registerTool(
		"manage_event",
		{
			description: `${config.systemPrompt}\n\nCreate, update, or delete events in Google Calendar. Times must be in format "DD-MM-YYYY HH-MM" (e.g., "01-01-2024 14-00"). Timezone conversion happens automatically using your configured timezone.`,
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
				const calendar = google.calendar({
					version: "v3",
					auth: await getAuthenticatedClient(),
				});

				let response: {
					success: boolean;
					message: string;
					event?: unknown;
					eventLink?: string;
				};

				const tz = timezone || config.timezone;

				switch (action) {
					case "create": {
						if (!title || !startTime) {
							throw new Error(
								"Title and startTime are required for creating events",
							);
						}

						const startDate = parseLocalTime(startTime, tz);
						validateNotInPast(startDate);

						let endDate: Date;
						if (endTime) {
							try {
								const durationMinutes = parseDuration(endTime);
								endDate = new Date(
									startDate.getTime() + durationMinutes * 60 * 1000,
								);
							} catch {
								endDate = parseLocalTime(endTime, tz);
							}
						} else {
							endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
						}

						validateEventTimes(startDate, endDate);

						const event = await calendar.events.insert({
							calendarId: "primary",
							requestBody: {
								summary: title,
								description: description || "",
								start: convertToGoogleCalendarFormat(startDate, tz),
								end: convertToGoogleCalendarFormat(endDate, tz),
							},
						});

						response = {
							success: true,
							message: `Created calendar event: ${title}`,
							event: event.data,
							eventLink: event.data.htmlLink || undefined,
						};
						break;
					}

					case "update": {
						if (!eventId) {
							throw new Error("eventId is required for updating events");
						}

						const existingEvent = await calendar.events.get({
							calendarId: "primary",
							eventId,
						});

						const updateData: {
							summary?: string;
							description?: string;
							start?: { dateTime: string; timeZone: string };
							end?: { dateTime: string; timeZone: string };
						} = {};

						if (title !== undefined) updateData.summary = title;
						if (description !== undefined) updateData.description = description;

						let startDate: Date | undefined;
						let endDate: Date | undefined;

						if (startTime) {
							startDate = parseLocalTime(startTime, tz);
							validateNotInPast(startDate);
							updateData.start = convertToGoogleCalendarFormat(startDate, tz);
						} else if (existingEvent.data.start?.dateTime) {
							startDate = new Date(existingEvent.data.start.dateTime);
						}

						if (endTime) {
							if (startDate) {
								try {
									const durationMinutes = parseDuration(endTime);
									endDate = new Date(
										startDate.getTime() + durationMinutes * 60 * 1000,
									);
								} catch {
									endDate = parseLocalTime(endTime, tz);
								}
							} else {
								endDate = parseLocalTime(endTime, tz);
							}
							updateData.end = convertToGoogleCalendarFormat(endDate, tz);
						} else if (existingEvent.data.end?.dateTime) {
							endDate = new Date(existingEvent.data.end.dateTime);
						}

						if (startDate && endDate) {
							validateEventTimes(startDate, endDate);
						}

						const event = await calendar.events.update({
							calendarId: "primary",
							eventId,
							requestBody: updateData,
						});

						response = {
							success: true,
							message: `Updated calendar event: ${event.data.summary || title}`,
							event: event.data,
							eventLink: event.data.htmlLink || undefined,
						};
						break;
					}

					case "delete": {
						if (!eventId) {
							throw new Error("eventId is required for deleting events");
						}

						// First, fetch the event to check if it's recurring
						const existingEvent = await calendar.events.get({
							calendarId: "primary",
							eventId,
						});

						const isRecurring = !!existingEvent.data.recurringEventId;
						const isRecurringMaster = !!existingEvent.data.recurrence;

						await calendar.events.delete({
							calendarId: "primary",
							eventId,
							sendUpdates,
						});

						let deleteMessage = "Deleted calendar event";
						if (isRecurringMaster) {
							deleteMessage = "Deleted recurring event series (all instances)";
						} else if (isRecurring) {
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
