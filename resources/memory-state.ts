import type {
	McpServer,
	ReadResourceCallback,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { config } from "@/config.ts";
import { resolvePath } from "@/lib/utils/path.ts";

export const registerMemoryStateResource = (server: McpServer) => {
	const readCallback: ReadResourceCallback = async (uri, _extra) => {
		// Read the state.yaml file
		const stateFilePath = resolvePath(config.stateFile);
		const stateFile = Bun.file(stateFilePath);

		// Check if file exists
		if (!(await stateFile.exists())) {
			throw new Error(`State file not found: ${stateFilePath}`);
		}

		// Read file content as text
		const content = await stateFile.text();

		return {
			contents: [
				{
					uri: uri.toString(),
					mimeType: "application/yaml",
					text: content,
				},
			],
		};
	};

	server.registerResource(
		"memory_state",
		`${config.serverName}://memory/state`,
		{
			description:
				"Active memory state containing goals, ideas, and settings (rotated/backed up periodically)",
			mimeType: "application/yaml",
		},
		readCallback,
	);
};
