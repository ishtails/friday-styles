import { z } from "zod";

// OKR-based Goal Structure
const KeyResultSchema = z.object({
	id: z.string(),
	description: z.string(),
	target: z.number().optional(), // e.g., 10, 50, 5
	current: z.number().optional(), // current progress
	unit: z.string().optional(), // e.g., "USD", "hours", "tracks"
	status: z
		.enum(["not_started", "in_progress", "completed", "at_risk"])
		.default("not_started"),
});

const ObjectiveSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().optional(),
	category: z.string(), // Flexible: users can use any category string
	keyResults: z.array(KeyResultSchema).default([]),
	calendarEventId: z.string().optional(), // Google Calendar event ID
	calendarEventLink: z.string().optional(), // Google Calendar event HTML link
	createdAt: z.number(), // Unix epoch milliseconds
	updatedAt: z.number(), // Unix epoch milliseconds
	status: z
		.enum(["active", "paused", "completed", "archived"])
		.default("active"),
});

// Ideas and Thoughts
const IdeaSchema = z.object({
	id: z.string(),
	content: z.string(),
	category: z.string(), // Flexible: users can use any category string
	tags: z.array(z.string()).default([]),
	relatedGoalId: z.string().optional(), // link to objective if applicable
	createdAt: z.number(), // Unix epoch milliseconds
	status: z.enum(["raw", "organized", "actionable", "archived"]).default("raw"),
	priority: z.enum(["low", "medium", "high"]).optional(),
});

export const StateSchema = z.object({
	version: z.string(),
	data: z.object({
		goals: z.array(ObjectiveSchema).default([]),
		ideas: z.array(IdeaSchema).default([]),
		settings: z
			.object({
				currency: z.string(), // Currency code (e.g., "USD", "EUR")
			})
			.optional(),
	}),
});

// Profile Schema - Flexible item schema that works for all categories
const ProfileItemSchema = z.object({
	id: z.string(),
	category: z.string(), // Flexible: achievements, skills, preferences, etc.
	content: z.string(), // Main content/description
	tags: z.array(z.string()).default([]), // Cross-cutting organization
	metadata: z.record(z.string(), z.unknown()).optional(), // Custom properties per item
	createdAt: z.number(), // Unix epoch milliseconds
	updatedAt: z.number().optional(),
});

// Profile groups items by category
export const ProfileSchema = z.object({
	version: z.string(),
	items: z.array(ProfileItemSchema).default([]),
});

export type State = z.infer<typeof StateSchema>;
export type Objective = z.infer<typeof ObjectiveSchema>;
export type KeyResult = z.infer<typeof KeyResultSchema>;
export type Idea = z.infer<typeof IdeaSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type ProfileItem = z.infer<typeof ProfileItemSchema>;
