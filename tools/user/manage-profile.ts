import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "@/config.ts";
import type { ProfileItem } from "@/lib/db/schema.ts";
import { generateId } from "@/lib/utils/id.ts";
import { log } from "@/lib/utils/logger.ts";
import { createReferenceNote } from "@/lib/utils/notes.ts";
import {
	addItem,
	deleteItem,
	getItemsByCategory,
	getProfile,
	updateItem,
} from "@/lib/utils/profile.ts";

export const registerManageProfile = (server: McpServer) => {
	server.registerTool(
		"manage_profile",
		{
			description: `${config.systemPrompt}\n\nManage your persistent profile data (achievements, skills, preferences, knowledge, facts, history). Use this to add, update, delete, or query profile items. Profile data persists across state rotations and serves as your permanent context. Can create reference markdown notes for additional context/details.`,
			inputSchema: {
				action: z
					.enum(["add", "get", "update", "delete", "list"])
					.describe("Action to perform on profile"),
				itemId: z
					.string()
					.optional()
					.describe("Item ID (required for get, update, delete)"),
				category: z
					.string()
					.optional()
					.describe(
						"Category of the item (e.g., achievements, skills, preferences, knowledge, facts, history). Can be any custom category.",
					),
				content: z
					.string()
					.optional()
					.describe("Content/description of the item (required for add)"),
				tags: z
					.array(z.string())
					.optional()
					.describe("Tags for cross-cutting organization"),
				metadata: z
					.record(z.string(), z.unknown())
					.optional()
					.describe("Custom metadata properties for the item"),
				refNote: z
					.string()
					.optional()
					.describe(
						"Reference markdown note content with additional context/details to create for this profile item. Always prefer adding a reference note when user provides more than a paragraph of context/details.",
					),
			},
		},
		async ({ action, itemId, category, content, tags, metadata, refNote }) => {
			try {
				if (action === "add") {
					if (!category || !content) {
						throw new Error(
							"Category and content are required for adding a profile item",
						);
					}

					const profile = await getProfile();
					const newItemId = generateId("p", profile.items);

					let refNotes: string[] = [];
					if (refNote) {
						try {
							const notePath = await createReferenceNote(
								"profile",
								newItemId,
								refNote,
							);
							refNotes = [notePath];
						} catch (error) {
							await log(
								"warn",
								"manage_profile",
								{ action, category },
								`Failed to create reference note: ${error instanceof Error ? error.message : "Unknown error"}`,
							);
						}
					}

					const newItem: ProfileItem = {
						id: newItemId,
						category,
						content,
						tags: tags || [],
						metadata,
						refNotes,
						createdAt: Date.now(),
					};

					await addItem(newItem);

					const response = `Added ${category} item to profile: "${content.substring(0, 50)}${content.length > 50 ? "..." : ""}"`;
					await log(
						"info",
						"manage_profile",
						{ action, category, content },
						response,
					);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{ success: true, message: response, item: newItem },
									null,
									2,
								),
							},
						],
					};
				}

				if (action === "get") {
					if (!itemId) {
						throw new Error("Item ID is required for getting a profile item");
					}

					const profile = await getProfile();
					const item = profile.items.find((i) => i.id === itemId);

					if (!item) {
						throw new Error(`Profile item with ID ${itemId} not found`);
					}

					await log(
						"info",
						"manage_profile",
						{ action, itemId },
						"Retrieved item",
					);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({ success: true, item }, null, 2),
							},
						],
					};
				}

				if (action === "update") {
					if (!itemId) {
						throw new Error("Item ID is required for updating a profile item");
					}

					const profile = await getProfile();
					const existingItem = profile.items.find((i) => i.id === itemId);
					if (!existingItem) {
						throw new Error(`Profile item with ID ${itemId} not found`);
					}

					let refNotes = existingItem.refNotes || [];
					if (refNote) {
						try {
							const notePath = await createReferenceNote(
								"profile",
								itemId,
								refNote,
							);
							refNotes = [...refNotes, notePath];
						} catch (error) {
							await log(
								"warn",
								"manage_profile",
								{ action, itemId },
								`Failed to create reference note: ${error instanceof Error ? error.message : "Unknown error"}`,
							);
						}
					}

					const updates: Partial<ProfileItem> = {};
					if (category) updates.category = category;
					if (content) updates.content = content;
					if (tags) updates.tags = tags;
					if (metadata) updates.metadata = metadata;
					updates.refNotes = refNotes;

					await updateItem(itemId, updates);
					const updatedProfile = await getProfile();
					const updatedItem = updatedProfile.items.find((i) => i.id === itemId);

					const response = `Updated profile item: ${itemId}`;
					await log("info", "manage_profile", { action, itemId }, response);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{ success: true, message: response, item: updatedItem },
									null,
									2,
								),
							},
						],
					};
				}

				if (action === "delete") {
					if (!itemId) {
						throw new Error("Item ID is required for deleting a profile item");
					}

					await deleteItem(itemId);

					const response = `Deleted profile item: ${itemId}`;
					await log("info", "manage_profile", { action, itemId }, response);

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

				if (action === "list") {
					const profile = await getProfile();
					let items = profile.items;

					if (category) {
						items = await getItemsByCategory(category);
					}

					// Sort by createdAt descending
					items = items.sort((a, b) => b.createdAt - a.createdAt);

					await log(
						"info",
						"manage_profile",
						{ action, category },
						`Listed ${items.length} items`,
					);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										success: true,
										count: items.length,
										category: category || "all",
										items,
									},
									null,
									2,
								),
							},
						],
					};
				}

				throw new Error(`Unknown action: ${action}`);
			} catch (error) {
				const errorMsg = `Failed to manage profile: ${String(error)}`;
				await log("error", "manage_profile", { action, itemId }, errorMsg);
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
