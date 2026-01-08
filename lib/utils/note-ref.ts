import { createNote } from "./notes.ts";

export function generateNoteId(itemType: string, itemId: string): string {
	const timestamp = Date.now();
	const typeMap: Record<string, string> = {
		goals: "goals",
		ideas: "ideas",
		profile: "profile",
	};
	const type = typeMap[itemType] || itemType;
	return `refs/${type}/${itemId}-${timestamp}.md`;
}

export async function createReferenceNote(
	itemType: string,
	itemId: string,
	content: string,
): Promise<string> {
	const path = generateNoteId(itemType, itemId);
	await createNote(path, content);
	return path;
}
