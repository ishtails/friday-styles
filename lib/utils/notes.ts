import { config } from "@/config.ts";
import { resolvePath } from "./path.ts";

export async function generateNotePath(title: string): Promise<string> {
	if (!config.obsidianVault) {
		throw new Error("Obsidian vault path not configured");
	}

	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.substring(0, 50);

	const vaultPath = resolvePath(config.obsidianVault);
	let filename = `${slug}.md`;
	let counter = 1;

	while (true) {
		const fullPath = `${vaultPath}/${filename}`;
		const file = Bun.file(fullPath);
		if (!(await file.exists())) {
			break;
		}
		filename = `${slug}-${counter}.md`;
		counter++;
	}

	return filename;
}

export async function writeNote(path: string, content: string): Promise<string> {
	if (!config.obsidianVault) {
		throw new Error("Obsidian vault path not configured");
	}

	const vaultPath = resolvePath(config.obsidianVault);
	const fullPath = `${vaultPath}/${path}`;

	await Bun.$`mkdir -p ${vaultPath}`.quiet();
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

export async function createReferenceNote(
	title: string,
	content: string,
): Promise<string> {
	const path = await generateNotePath(title);
	await writeNote(path, content);
	return path;
}
