import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "@/config.ts";
import { log } from "@/lib/utils/logger.ts";
import { resolvePath } from "@/lib/utils/path.ts";
import { buildYtDlpArgs, checkYtDlpAvailable } from "@/lib/utils/youtube.ts";

export const registerDownloadMedia = (server: McpServer) => {
	server.registerTool(
		"download_media",
		{
			description: `${config.systemPrompt}\n\nDownload videos or audio from YouTube and other supported sites using yt-dlp. Supports configurable quality and format options. Downloads are stored in the configured downloads directory.`,
			inputSchema: {
				url: z.string().url().describe("Video or playlist URL to download"),
				format: z
					.enum(["video", "audio", "both"])
					.optional()
					.default("video")
					.describe(
						"Download format: 'video' for video files, 'audio' for audio extraction, 'both' for best available",
					),
				quality: z
					.string()
					.optional()
					.default("best")
					.describe(
						"Quality selection: 'best', 'worst', or specific format code (e.g., '22' for 720p)",
					),
				outputPath: z
					.string()
					.optional()
					.describe(
						"Custom output path/filename template. Uses yt-dlp template syntax (e.g., '%(title)s.%(ext)s'). Defaults to downloads directory with title and extension.",
					),
				audioFormat: z
					.string()
					.optional()
					.describe(
						"Audio format when extracting audio (mp3, m4a, opus, etc.). Defaults to mp3.",
					),
			},
		},
		async ({
			url,
			format = "video",
			quality = "best",
			outputPath,
			audioFormat,
		}) => {
			try {
				// Check if yt-dlp is available
				const ytDlpCheck = await checkYtDlpAvailable();
				if (!ytDlpCheck.available) {
					throw new Error(
						"yt-dlp is not installed. Please install it with: brew install yt-dlp (or use bunx yt-dlp)",
					);
				}

				// Resolve downloads directory
				const downloadsDir = resolvePath(config.downloadsDir);
				await Bun.$`mkdir -p ${downloadsDir}`.quiet();

				// Build output template - use .mp4 extension for video downloads by default
				const outputTemplate =
					outputPath ||
					(format === "video" || format === "both"
						? `${downloadsDir}/%(title)s.mp4`
						: `${downloadsDir}/%(title)s.%(ext)s`);

				// Build command arguments
				const args = buildYtDlpArgs(
					url,
					format,
					quality,
					outputTemplate,
					audioFormat,
				);

				// Execute yt-dlp command
				const command = ytDlpCheck.useBunx ? ["bunx", "yt-dlp"] : ["yt-dlp"];
				const proc = Bun.spawn([...command, ...args], {
					stdout: "pipe",
					stderr: "pipe",
				});

				const [stdout, stderr, exitCode] = await Promise.all([
					new Response(proc.stdout).arrayBuffer(),
					new Response(proc.stderr).arrayBuffer(),
					proc.exited,
				]);

				const result = {
					stdout: Buffer.from(stdout),
					stderr: Buffer.from(stderr),
					exitCode,
				};

				// Check if command failed
				if (exitCode !== 0) {
					throw new Error(
						`yt-dlp failed with exit code ${exitCode}: ${result.stderr.toString()}`,
					);
				}

				// Try to extract metadata from output
				const output = result.stdout?.toString() || "";
				const stderrOutput = result.stderr?.toString() || "";

				// Parse output to find downloaded file
				// yt-dlp typically outputs the final filename at the end
				const lines = output.split("\n").filter((line) => line.trim());

				// Try to extract file path from output
				// yt-dlp outputs: "[download] Destination: filename.ext" or just the filename
				let downloadedFile = "";
				for (const line of lines.reverse()) {
					if (!line) continue;
					if (line.includes("[download]") && line.includes("Destination:")) {
						const match = line.match(/Destination:\s*(.+)/);
						if (match?.[1]) {
							downloadedFile = match[1].trim();
							break;
						}
					}
					if (!line.startsWith("[") && line.includes(".")) {
						// Likely a filename
						if (line.startsWith(downloadsDir) || line.includes("/")) {
							downloadedFile = line.trim();
							break;
						}
					}
				}

				// If we couldn't parse it, try to find files in the downloads directory
				if (!downloadedFile) {
					const files = await Array.fromAsync(
						new Bun.Glob("**/*").scan(downloadsDir),
					);
					// Get the most recently modified file
					let latestFile: string | null = null;
					let latestTime = 0;
					for (const file of files) {
						const filePath = resolve(downloadsDir, file);
						try {
							const fileStat = await stat(filePath);
							if (fileStat.mtime && fileStat.mtime.getTime() > latestTime) {
								latestTime = fileStat.mtime.getTime();
								latestFile = filePath;
							}
						} catch {}
					}
					if (latestFile) {
						downloadedFile = latestFile;
					}
				}

				// Get file stats if file exists
				let fileSize: number | undefined;
				let filePath: string | undefined;
				if (downloadedFile) {
					const file = Bun.file(downloadedFile);
					if (await file.exists()) {
						try {
							const fileStat = await stat(downloadedFile);
							fileSize = fileStat.size;
							filePath = downloadedFile;
						} catch {
							// If stat fails, still use the file path
							filePath = downloadedFile;
						}
					}
				}

				const message = `Downloaded ${format}: ${url}`;
				await log(
					"info",
					"download_media",
					{ url, format, quality, outputPath, audioFormat },
					message,
				);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									message,
									url,
									format,
									quality,
									filePath: filePath || downloadedFile || "unknown",
									fileSize,
									output: output || stderrOutput,
								},
								null,
								2,
							),
						},
					],
				};
			} catch (error) {
				const errorMsg = `Failed to download media: ${String(error)}`;
				await log(
					"error",
					"download_media",
					{ url, format, quality, outputPath, audioFormat },
					errorMsg,
				);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: false,
									error: errorMsg,
									details:
										error instanceof Error ? error.message : String(error),
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
