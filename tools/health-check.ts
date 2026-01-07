import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { config } from "@/config.ts";
import { ProfileSchema, StateSchema } from "@/lib/db/schema.ts";
import { getProfile } from "@/lib/utils/profile.ts";
import { getState } from "@/lib/utils/state.ts";

export const registerHealthCheck = (server: McpServer) => {
	server.registerTool(
		"health_check",
		{
			description: `${config.systemPrompt}\n\nCheck server health and state/profile validity`,
		},
		async () => {
			try {
				const state = await getState();
				StateSchema.parse(state);

				const profile = await getProfile();
				ProfileSchema.parse(profile);

				const timestamp = Date.now();
				const currentISO = new Date(timestamp).toISOString();
				const timezone = config.timezone;

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									status: "healthy",
									stateValid: true,
									profileValid: true,
									currentTimestamp: timestamp,
									currentISO,
									timezone,
								},
								null,
								2,
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{ status: "unhealthy", error: String(error) },
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
