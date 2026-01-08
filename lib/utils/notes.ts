import { config } from "@/config.ts";
import { resolvePath } from "./path.ts";

export async function createNote(
	path: string,
	content: string,
): Promise<string> {
	if (!config.obsidianVault) {
		throw new Error("Obsidian vault path not configured");
	}

	const vaultPath = resolvePath(config.obsidianVault);
	const fullPath = `${vaultPath}/${path}`;

	await Bun.$`mkdir -p ${vaultPath}`.quiet();
	const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
	await Bun.$`mkdir -p ${dir}`.quiet();

	await Bun.write(fullPath, content);
	return path;
}

export async function updateNote(
	path: string,
	content: string,
): Promise<string> {
	if (!config.obsidianVault) {
		throw new Error("Obsidian vault path not configured");
	}

	const vaultPath = resolvePath(config.obsidianVault);
	const fullPath = `${vaultPath}/${path}`;

	await Bun.write(fullPath, content);
	return path;
}

export async function deleteNote(path: string): Promise<void> {
	if (!config.obsidianVault) {
		throw new Error("Obsidian vault path not configured");
	}

	const vaultPath = resolvePath(config.obsidianVault);
	const fullPath = `${vaultPath}/${path}`;

	const file = Bun.file(fullPath);
	if (!(await file.exists())) {
		throw new Error(`Note not found: ${path}`);
	}

	await Bun.$`rm ${fullPath}`.quiet();
}

export async function noteExists(path: string): Promise<boolean> {
	if (!config.obsidianVault) {
		return false;
	}

	const vaultPath = resolvePath(config.obsidianVault);
	const fullPath = `${vaultPath}/${path}`;
	const file = Bun.file(fullPath);
	return await file.exists();
}

export async function readNote(path: string): Promise<string> {
	if (!config.obsidianVault) {
		throw new Error("Obsidian vault path not configured");
	}

	const vaultPath = resolvePath(config.obsidianVault);
	const fullPath = `${vaultPath}/${path}`;

	const file = Bun.file(fullPath);
	if (!(await file.exists())) {
		throw new Error(`Note not found: ${path}`);
	}

	return await file.text();
}

export function generateNoteId(itemType: string, itemId: string): string {
	const timestamp = Date.now();
	const typeMap: Record<string, string> = {
		goals: "goals",
		ideas: "ideas",
		profile: "profile",
	};
	const type = typeMap[itemType] || itemType;
	return `refs/${type}-${itemId}-${timestamp}.md`;
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
