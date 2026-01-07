import { dirname } from "node:path";
import { config } from "@/config.ts";
import { ProfileSchema, StateSchema } from "@/lib/db/schema.ts";
import { resolvePath } from "./path.ts";
import { saveProfile } from "./profile.ts";
import { saveState } from "./state.ts";

const STATE_VERSION = "1.0.0";
const PROFILE_VERSION = "1.0.0";

export const initializeGenerated = async (): Promise<void> => {
	const stateFilePath = resolvePath(config.stateFile);
	const profileFilePath = resolvePath(config.profileFile);
	const logFilePath = resolvePath(config.logFile);
	const designsDir = resolvePath(config.designsDir);
	const downloadsDir = resolvePath(config.downloadsDir);
	const generatedDir = dirname(stateFilePath);

	// Ensure base generated, designs, and downloads directories exist
	await Bun.$`mkdir -p ${generatedDir}`.quiet();
	await Bun.$`mkdir -p ${designsDir}`.quiet();
	await Bun.$`mkdir -p ${downloadsDir}`.quiet();

	// Ensure state.yaml exists with a valid default state
	const stateFile = Bun.file(stateFilePath);
	if (!(await stateFile.exists())) {
		const initialState = StateSchema.parse({
			version: STATE_VERSION,
			data: {},
		});
		await saveState(initialState);
	}

	// Ensure profile.yaml exists with a valid default profile
	const profileFile = Bun.file(profileFilePath);
	if (!(await profileFile.exists())) {
		const initialProfile = ProfileSchema.parse({
			version: PROFILE_VERSION,
			items: [],
		});
		await saveProfile(initialProfile);
	}

	// Ensure changelog.txt exists (leave empty if newly created)
	const logFile = Bun.file(logFilePath);
	if (!(await logFile.exists())) {
		await Bun.write(logFile, "");
	}

	// Server initialized - do not log to stdout as it breaks MCP protocol
};
