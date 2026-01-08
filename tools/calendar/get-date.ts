import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { config } from "@/config.ts";
import { log } from "@/lib/utils/logger.ts";

export const registerGetDate = (server: McpServer) => {
	server.registerTool(
		"get_date",
		{
			description: `${config.systemPrompt}\n\nGet current date and time. Returns timestamp, UTC ISO datetime string, user's timezone, and local time. Shows example formats accepted by calendar event tools.`,
		},
		async () => {
			try {
				const timestamp = Date.now();
				const currentISO = new Date(timestamp).toISOString();
				const timezone = config.timezone;

				// Get current time in user's timezone
				const localDate = new Date(timestamp);
				const localTimeString = localDate.toLocaleString("en-US", {
					timeZone: timezone,
					year: "numeric",
					month: "2-digit",
					day: "2-digit",
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
					hour12: false,
					timeZoneName: "short",
				});

				const now = new Date(timestamp);
				const currentHour = now.toLocaleString("en-US", {
					timeZone: timezone,
					hour: "2-digit",
					minute: "2-digit",
					hour12: false,
				});
				const currentDate = now
					.toLocaleString("en-US", {
						timeZone: timezone,
						year: "numeric",
						month: "2-digit",
						day: "2-digit",
					})
					.replace(/\//g, "-");

				const ddmmyyyy = currentDate.split("-").reverse().join("/");
				const hhmm = currentHour.replace(":", "-");

				const result = {
					success: true,
					timestamp,
					currentISO,
					timezone,
					localTime: localTimeString,
					exampleFormat: `"${ddmmyyyy} ${hhmm}"`,
					currentLocalTime: currentHour,
					currentLocalDate: currentDate,
					message: `Current date/time: ${currentISO} UTC (${localTimeString}, timestamp: ${timestamp})`,
				};

				await log("info", "get_date", {}, result.message);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			} catch (error) {
				const msg = error instanceof Error ? error.message : "Unknown error";
				await log("error", "get_date", {}, msg);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: false,
									error: `Error getting date: ${msg}`,
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
