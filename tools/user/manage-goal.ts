import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { google } from "googleapis";
import { z } from "zod";
import { config } from "@/config.ts";
import type { KeyResult, Objective } from "@/lib/db/schema.ts";
import {
	convertToGoogleCalendarFormat,
	parseDuration,
	parseLocalTime,
	validateEventTimes,
	validateNotInPast,
} from "@/lib/utils/datetime.ts";
import { getAuthenticatedClient } from "@/lib/utils/google-auth.ts";
import { generateId } from "@/lib/utils/id.ts";
import { log } from "@/lib/utils/logger.ts";
import { createReferenceNote } from "@/lib/utils/note-ref.ts";
import { getState, updateState } from "@/lib/utils/state.ts";

export const registerManageGoal = (server: McpServer) => {
	server.registerTool(
		"manage_goal",
		{
			description: `${config.systemPrompt}\n\nManage active/paused goals with OKR (Objectives and Key Results) structure. Use this for CURRENT goals you're working on. Optionally, ask user if they want to add completed goals to their profile as achievements. Time sensitive goals should be created with a calendar event always. Can create reference notes in Obsidian for additional context/details.`,
			inputSchema: {
				action: z
					.enum(["create", "update", "delete"])
					.describe("Action to perform on the goal"),
				goalId: z
					.string()
					.optional()
					.describe("Goal ID (required for update/delete)"),
				title: z
					.string()
					.optional()
					.describe("Objective title (required for create)"),
				description: z.string().optional().describe("Objective description"),
				category: z
					.string()
					.optional()
					.describe("Category of the goal (any string)"),
				keyResults: z
					.array(
						z.object({
							id: z.string().optional(),
							description: z.string(),
							target: z.string().optional(),
							current: z.string().optional(),
							unit: z.string().optional(),
							status: z
								.enum(["not_started", "in_progress", "completed", "at_risk"])
								.optional(),
						}),
					)
					.optional()
					.describe("Key results for this objective"),
				status: z
					.enum(["active", "paused", "completed", "archived"])
					.optional()
					.describe("Goal status"),
				calendarEvent: z
					.object({
						startTime: z
							.string()
							.describe(
								'Start time in format "DD-MM-YYYY HH-MM" (e.g., "01-01-2024 14-00")',
							),
						endTime: z
							.string()
							.optional()
							.describe(
								'End time in same format, or duration like "1h", "90m". Defaults to 1 hour after start.',
							),
						timezone: z
							.string()
							.optional()
							.describe(
								"Override timezone (defaults to configured timezone). Use IANA timezone names.",
							),
					})
					.optional()
					.describe("Optional calendar event to create for this goal"),
				refNote: z
					.string()
					.optional()
					.describe(
						"Reference note content with additional context/details to create in Obsidian for this goal",
					),
			},
		},
		async ({
			action,
			goalId,
			title,
			description,
			category,
			keyResults,
			status,
			calendarEvent,
			refNote,
		}) => {
			try {
				const state = await getState();

				if (action === "create") {
					if (!title || !category) {
						throw new Error(
							"Title and category are required for creating a goal",
						);
					}

					const newGoalId = generateId("g", state.data.goals);
					const now = Date.now();

					// Count existing key results across all goals to generate sequential KR IDs
					const totalKRs = state.data.goals.reduce(
						(sum, g) => sum + g.keyResults.length,
						0,
					);

					const processedKeyResults: KeyResult[] = (keyResults || []).map(
						(kr, index) => {
							const targetNum = kr.target ? parseFloat(kr.target) : undefined;
							const currentNum = kr.current
								? parseFloat(kr.current)
								: undefined;
							return {
								id: kr.id || `kr${totalKRs + index + 1}`,
								description: kr.description,
								target:
									targetNum !== undefined && !Number.isNaN(targetNum)
										? targetNum
										: undefined,
								current:
									currentNum !== undefined && !Number.isNaN(currentNum)
										? currentNum
										: undefined,
								unit: kr.unit,
								status: kr.status || "not_started",
							};
						},
					);

					// Create calendar event first if requested
					let calendarEventId: string | undefined;
					let calendarEventLink: string | undefined;
					if (calendarEvent) {
						try {
							const tz = calendarEvent.timezone || config.timezone;
							const start = parseLocalTime(calendarEvent.startTime, tz);
							validateNotInPast(start);

							let end: Date;
							if (calendarEvent.endTime) {
								try {
									const durationMinutes = parseDuration(calendarEvent.endTime);
									end = new Date(start.getTime() + durationMinutes * 60 * 1000);
								} catch {
									end = parseLocalTime(calendarEvent.endTime, tz);
								}
							} else {
								end = new Date(start.getTime() + 60 * 60 * 1000);
							}

							validateEventTimes(start, end);

							const calendar = google.calendar({
								version: "v3",
								auth: await getAuthenticatedClient(),
							});

							const event = await calendar.events.insert({
								calendarId: "primary",
								requestBody: {
									summary: title,
									description: description || "",
									start: convertToGoogleCalendarFormat(start, tz),
									end: convertToGoogleCalendarFormat(end, tz),
								},
							});

							calendarEventId = event.data.id || undefined;
							calendarEventLink = event.data.htmlLink || undefined;
						} catch (error) {
							await log(
								"warn",
								"manage_goal",
								{ action, title },
								`Failed to create calendar event: ${error instanceof Error ? error.message : "Unknown error"}`,
							);
						}
					}

					let refNotes: string[] = [];
					if (refNote) {
						try {
							const notePath = await createReferenceNote(
								"goals",
								newGoalId,
								refNote,
							);
							refNotes = [notePath];
						} catch (error) {
							await log(
								"warn",
								"manage_goal",
								{ action, title },
								`Failed to create reference note: ${error instanceof Error ? error.message : "Unknown error"}`,
							);
						}
					}

					const newGoal: Objective = {
						id: newGoalId,
						title,
						description,
						category,
						keyResults: processedKeyResults,
						...(calendarEventId && { calendarEventId }),
						...(calendarEventLink && { calendarEventLink }),
						refNotes,
						createdAt: now,
						updatedAt: now,
						status: status || "active",
					};

					const updatedGoals = [...state.data.goals, newGoal];
					await updateState({
						data: {
							...state.data,
							goals: updatedGoals,
						},
					});

					const response = `Created goal: ${title}${calendarEventLink ? " (calendar event created)" : ""}`;
					await log(
						"info",
						"manage_goal",
						{ action, title, category },
						response,
					);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										success: true,
										message: response,
										goal: newGoal,
										calendarEventLink,
									},
									null,
									2,
								),
							},
						],
					};
				}

				if (action === "update") {
					if (!goalId) {
						throw new Error("Goal ID is required for updating");
					}

					const goalIndex = state.data.goals.findIndex((g) => g.id === goalId);
					if (goalIndex < 0) {
						throw new Error(`Goal with ID ${goalId} not found`);
					}

					const existingGoal = state.data.goals[goalIndex];
					if (!existingGoal) {
						throw new Error(`Goal with ID ${goalId} not found`);
					}

					// Count existing key results across all goals for new KR IDs
					const totalKRs = state.data.goals.reduce(
						(sum, g) => sum + g.keyResults.length,
						0,
					);
					let newKrCounter = totalKRs + 1;

					let refNotes = existingGoal.refNotes || [];
					if (refNote) {
						try {
							const notePath = await createReferenceNote(
								"goals",
								goalId,
								refNote,
							);
							refNotes = [...refNotes, notePath];
						} catch (error) {
							await log(
								"warn",
								"manage_goal",
								{ action, goalId },
								`Failed to create reference note: ${error instanceof Error ? error.message : "Unknown error"}`,
							);
						}
					}

					const updatedGoal: Objective = {
						...existingGoal,
						...(title && { title }),
						...(description !== undefined && { description }),
						...(category && { category }),
						...(status && { status }),
						refNotes,
						...(keyResults && {
							keyResults: keyResults.map((kr) => {
								const existingKr = existingGoal.keyResults.find(
									(ekr) =>
										ekr.id === kr.id || ekr.description === kr.description,
								);
								const targetNum = kr.target ? parseFloat(kr.target) : undefined;
								const currentNum = kr.current
									? parseFloat(kr.current)
									: undefined;
								return {
									id: kr.id || existingKr?.id || `kr${newKrCounter++}`,
									description: kr.description,
									target:
										targetNum !== undefined && !Number.isNaN(targetNum)
											? targetNum
											: existingKr?.target,
									current:
										currentNum !== undefined && !Number.isNaN(currentNum)
											? currentNum
											: existingKr?.current,
									unit: kr.unit ?? existingKr?.unit,
									status: kr.status || existingKr?.status || "not_started",
								};
							}),
						}),
						updatedAt: Date.now(),
					};

					const updatedGoals = [...state.data.goals];
					updatedGoals[goalIndex] = updatedGoal;

					await updateState({
						data: {
							...state.data,
							goals: updatedGoals,
						},
					});

					const response = `Updated goal: ${updatedGoal.title}`;
					await log("info", "manage_goal", { action, goalId }, response);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{ success: true, message: response, goal: updatedGoal },
									null,
									2,
								),
							},
						],
					};
				}

				if (action === "delete") {
					if (!goalId) {
						throw new Error("Goal ID is required for deleting");
					}

					const updatedGoals = state.data.goals.filter((g) => g.id !== goalId);
					await updateState({
						data: {
							...state.data,
							goals: updatedGoals,
						},
					});

					const response = `Deleted goal with ID: ${goalId}`;
					await log("info", "manage_goal", { action, goalId }, response);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{ success: true, message: response },
									null,
									2,
								),
							},
						],
					};
				}

				throw new Error(`Unknown action: ${action}`);
			} catch (error) {
				const errorMsg = `Failed to manage goal: ${String(error)}`;
				await log("error", "manage_goal", { action, goalId }, errorMsg);
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
