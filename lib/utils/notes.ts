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

export async function writeNote(
	path: string,
	content: string,
): Promise<string> {
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

export function extractNoteTitle(path: string): string {
	const baseName = path.replace(/\.md$/, "");
	return baseName
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

export async function findRelatedNotes(
	category: string,
	excludePath?: string,
): Promise<string[]> {
	if (!config.obsidianVault) {
		return [];
	}

	const vaultPath = resolvePath(config.obsidianVault);
	const files = await Bun.$`find ${vaultPath} -maxdepth 1 -name "*.md"`.text();
	const noteFiles = files
		.trim()
		.split("\n")
		.filter((f): f is string => Boolean(f?.endsWith(".md")))
		.map((f) => f.replace(`${vaultPath}/`, ""))
		.filter((f) => f !== excludePath);

	const related: string[] = [];
	for (const file of noteFiles.slice(0, 10)) {
		try {
			const content = await readNote(file);
			if (content.toLowerCase().includes(category.toLowerCase())) {
				related.push(file);
				if (related.length >= 3) break;
			}
		} catch {}
	}

	return related;
}

export async function addLinkToNote(
	path: string,
	linkPath: string,
): Promise<void> {
	const content = await readNote(path);
	const linkTitle = extractNoteTitle(linkPath);
	const linkText = `[[${linkTitle}]]`;

	if (content.includes(linkText)) {
		return;
	}

	const updatedContent = `${content}${content.endsWith("\n") ? "" : "\n"}${linkText}\n`;
	await writeNote(path, updatedContent);
}

export async function createReferenceNote(
	title: string,
	content: string,
	options?: { isOverview?: boolean; relatedCategory?: string },
): Promise<string> {
	const path = await generateNotePath(title);
	let finalContent = content;

	if (options?.isOverview && options.relatedCategory) {
		const related = await findRelatedNotes(options.relatedCategory, path);
		if (related.length > 0) {
			const relatedSection =
				"\n\n## Related\n" +
				related.map((r) => `- [[${extractNoteTitle(r)}]]`).join("\n");
			finalContent = content + relatedSection;
		}
	}

	await writeNote(path, finalContent);
	return path;
}
