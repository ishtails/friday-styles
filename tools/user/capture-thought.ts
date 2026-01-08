import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "@/config.ts";
import type { Idea } from "@/lib/db/schema.ts";
import { generateId } from "@/lib/utils/id.ts";
import { log } from "@/lib/utils/logger.ts";
import { createReferenceNote } from "@/lib/utils/note-ref.ts";
import { getState, updateState } from "@/lib/utils/state.ts";

export const registerCaptureThought = (server: McpServer) => {
	server.registerTool(
		"capture_thought",
		{
			description: `${config.systemPrompt}\n\nCapture TEMPORARY ideas, thoughts, or plans. Use for: 'I should try X', 'Maybe I could Y', 'What if Z'. DO NOT use for: Permanent knowledge ('I learned X'), established facts ('I always do Y'), achievements ('I completed Z'). For permanent data, use manage_profile directly. The system will organize and categorize them automatically. Can create reference notes in Obsidian for additional context/details.`,
			inputSchema: {
				content: z
					.string()
					.describe(
						"Raw thought, idea, or plan to capture. Can be messy or unstructured.",
					),
				category: z
					.string()
					.describe("Category of the thought/idea (any string)"),
				tags: z
					.array(z.string())
					.optional()
					.describe("Optional tags for better organization"),
				priority: z
					.enum(["low", "medium", "high"])
					.optional()
					.describe("Priority level if known"),
				refNote: z
					.string()
					.optional()
					.describe(
						"Reference note content with additional context/details to create in Obsidian for this idea",
					),
			},
		},
		async ({ content, category, tags, priority, refNote }) => {
			try {
				const state = await getState();
				const ideaId = generateId("i", state.data.ideas);

				let refNotes: string[] = [];
				if (refNote) {
					try {
						const notePath = await createReferenceNote(
							"ideas",
							ideaId,
							refNote,
						);
						refNotes = [notePath];
					} catch (error) {
						await log(
							"warn",
							"capture_thought",
							{ content, category },
							`Failed to create reference note: ${error instanceof Error ? error.message : "Unknown error"}`,
						);
					}
				}

				const newIdea: Idea = {
					id: ideaId,
					content,
					category,
					tags: tags || [],
					refNotes,
					status: "raw",
					priority,
					createdAt: Date.now(),
				};

				const updatedIdeas = [...state.data.ideas, newIdea];
				await updateState({
					data: {
						...state.data,
						ideas: updatedIdeas,
					},
				});

				const response = `Captured ${category} idea: "${content.substring(0, 100)}${content.length > 100 ? "..." : ""}"`;
				await log(
					"info",
					"capture_thought",
					{ content, category, tags, priority },
					response,
				);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									ideaId,
									message: "Thought captured and will be organized",
									idea: newIdea,
								},
								null,
								2,
							),
						},
					],
				};
			} catch (error) {
				const errorMsg = `Failed to capture thought: ${String(error)}`;
				await log("error", "capture_thought", { content, category }, errorMsg);
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
