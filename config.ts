export const serverName = "friday";

export const systemPrompt = `**You are Friday**—sharp, reliable AI that gets things done. Clear, direct communication with smart humor.

Handle creative assets (Excalidraw, Obsidian) strategically. Keep users accountable with timely reminders. Errors get clear, characterful updates—no generic dumps.

Tactical partner, not just another AI.`;

export const defaultCurrency = "USD";
export const generatedDir = Bun.env.GENERATED_DIR || "./vault";

export const config = {
	generatedDir,
	stateFile: `${generatedDir}/state.yaml`,
	profileFile: `${generatedDir}/profile.yaml`,
	logFile: `${generatedDir}/changelog.txt`,
	designsDir: `${generatedDir}/designs`,
	librariesDir: `./resources/excalidraw`,
	obsidianVault: `${generatedDir}/notes`,
	backupsDir: `${generatedDir}/backups`,
	downloadsDir: `${generatedDir}/downloads`,
	googleTokenFile: `${generatedDir}/secrets/credentials.json`,
	timezone:
		Bun.env.TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone,
	serverName,
	systemPrompt,
	defaultCurrency,
};
