import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { log } from "@/lib/utils/logger.ts";

export const registerRunShortcut = (server: McpServer) => {
	server.registerTool(
		"run_shortcut",
		{
			description:
				"Run an Apple Shortcut from the command line. Supports input/output paths and various formats.",
			inputSchema: {
				shortcutName: z.string().describe("Name of the shortcut to run"),
				inputText: z
					.string()
					.optional()
					.describe("Optional text input to pass to the shortcut"),
				inputPath: z
					.string()
					.optional()
					.describe("Optional file path to pass as input to the shortcut"),
				outputPath: z
					.string()
					.optional()
					.describe("Optional output path to save shortcut results"),
				outputType: z
					.string()
					.optional()
					.describe(
						"Optional output type (Uniform Type Indicator like 'public.png' or 'public.text')",
					),
			},
		},
		async ({ shortcutName, inputText, inputPath, outputPath, outputType }) => {
			try {
				// Create a temporary file if input text is provided
				let tempFile: string | undefined;

				if (inputText) {
					tempFile = `/tmp/shortcut-input-${Date.now()}.txt`;
					await Bun.write(tempFile, inputText);
				}

				try {
					// Build command arguments array
					const args: string[] = ["run", shortcutName];

					// Add input path (prioritize explicit inputPath over tempFile)
					const finalInputPath = inputPath || tempFile;
					if (finalInputPath) {
						args.push("--input-path", finalInputPath);
					}

					// Add output path if specified
					if (outputPath) {
						args.push("--output-path", outputPath);
					}

					// Add output type if specified
					if (outputType) {
						args.push("--output-type", outputType);
					}

					// Execute the shortcut command using spawn for better control
					const proc = Bun.spawn(["/usr/bin/shortcuts", ...args], {
						stdout: "pipe",
						stderr: "pipe",
					});

					const [stdout, stderr, exitCode] = await Promise.all([
						new Response(proc.stdout).arrayBuffer(),
						new Response(proc.stderr).arrayBuffer(),
						proc.exited,
					]);

					const stdoutText = Buffer.from(stdout).toString();
					const stderrText = Buffer.from(stderr).toString();

					// Check if command failed
					if (exitCode !== 0) {
						throw new Error(
							`shortcuts command failed with exit code ${exitCode}: ${stderrText || stdoutText || "Unknown error"}`,
						);
					}

					await log(
						"info",
						"run_shortcut",
						{
							shortcutName,
							hasInput: !!(inputText || inputPath),
							hasOutput: !!(outputPath || outputType),
						},
						`Successfully ran shortcut: ${shortcutName}`,
					);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										success: true,
										message: `Successfully ran shortcut: ${shortcutName}`,
										shortcutName,
										hadInput: !!(inputText || inputPath),
										hadOutput: !!(outputPath || outputType),
										inputPath: inputPath || tempFile,
										outputPath,
										outputType,
										output: stdoutText || undefined,
									},
									null,
									2,
								),
							},
						],
					};
				} finally {
					// Clean up temp file if created
					if (tempFile) {
						try {
							await Bun.$`rm ${tempFile}`.quiet();
						} catch {
							// Ignore cleanup errors
						}
					}
				}
			} catch (error) {
				const errorDetails =
					error instanceof Error ? error.message : String(error);
				const errorMsg = `Failed to run shortcut "${shortcutName}": ${errorDetails}`;

				await log(
					"error",
					"run_shortcut",
					{
						shortcutName,
						inputText: inputText?.substring(0, 100),
						inputPath,
						outputPath,
						outputType,
						error: errorDetails,
					},
					errorMsg,
				);

				// Provide helpful error message about permissions if it's a helper communication error
				const isPermissionError =
					errorDetails.includes(
						"Couldn't communicate with a helper application",
					) || errorDetails.includes("helper application");

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: false,
									error: errorMsg,
									hint: isPermissionError
										? "This may be a macOS permissions issue. Ensure Cursor has Automation permissions in System Settings > Privacy & Security > Automation."
										: undefined,
								},
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
