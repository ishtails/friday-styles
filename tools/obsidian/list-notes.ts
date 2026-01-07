import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { config } from "@/config.ts";
import { log } from "@/lib/utils/logger.ts";
import { resolvePath } from "@/lib/utils/path.ts";

export const registerListNotes = (server: McpServer) => {
	server.registerTool(
		"list_notes",
		{
			description: `${config.systemPrompt}\n\nQuery notes and return metadata (paths and frontmatter). Does not return note content.`,
		},
		async () => {
			try {
				if (!config.obsidianVault) {
					throw new Error("Obsidian vault path not configured");
				}

				const vaultPath = resolvePath(config.obsidianVault);
				await Bun.$`mkdir -p ${vaultPath}`.quiet();

				const files = await readdir(vaultPath, { recursive: true });
				const noteFiles = files.filter(
					(f) => typeof f === "string" && f.endsWith(".md"),
				);

				const notes = await Promise.all(
					noteFiles.map(async (filename) => {
						const fullPath = resolve(vaultPath, filename);
						const frontmatter: Record<string, unknown> = {};
						try {
							const file = Bun.file(fullPath);
							if (await file.exists()) {
								const content = await file.slice(0, 2048).text();
								const frontmatterMatch = content.match(
									/^---\s*\n([\s\S]*?)\n---\s*\n/,
								);
								if (frontmatterMatch?.[1]) {
									for (const line of frontmatterMatch[1].split("\n")) {
										const match = line.match(/^(\w+):\s*(.+)$/);
										if (match?.[1] && match?.[2]) {
											let value: unknown = match[2].trim();
											if (value === "true") value = true;
											else if (value === "false") value = false;
											else if (/^\d+$/.test(value as string))
												value = parseInt(value as string, 10);
											else if (/^\[.*\]$/.test(value as string)) {
												value = (value as string)
													.slice(1, -1)
													.split(",")
													.map((v) => v.trim().replace(/^["']|["']$/g, ""));
											} else {
												value = (value as string).replace(/^["']|["']$/g, "");
											}
											frontmatter[match[1]] = value;
										}
									}
								}
							}
						} catch {
							// Ignore parsing errors
						}
						return {
							path: filename,
							filename,
							absolutePath: fullPath,
							...(Object.keys(frontmatter).length > 0 && { frontmatter }),
						};
					}),
				);

				await log("info", "list_notes", {}, `Listed ${notes.length} notes`);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{ success: true, count: notes.length, notes },
								null,
								2,
							),
						},
					],
				};
			} catch (error) {
				const errorMsg = `Failed to list notes: ${String(error)}`;
				await log("error", "list_notes", {}, errorMsg);
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
