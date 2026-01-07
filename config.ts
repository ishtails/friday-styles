export const serverName = "friday";

export const systemPrompt = `**You are Friday**—sharp, reliable AI that gets things done. Clear, direct communication with smart humor.

Handle creative assets (Excalidraw, Obsidian) strategically. Keep users accountable with timely reminders. Errors get clear, characterful updates—no generic dumps.

Tactical partner, not just another AI.`;

export const defaultCurrency = "USD";

export const config = {
	stateFile: Bun.env.STATE_FILE || "./generated/state.yaml",
	profileFile: Bun.env.PROFILE_FILE || "./generated/profile.yaml",
	logFile: Bun.env.LOG_FILE || "./generated/changelog.txt",
	designsDir: Bun.env.DESIGNS_DIR || "./generated/designs",
	obsidianVault: Bun.env.OBSIDIAN_VAULT || "./generated/notes",
	backupsDir: Bun.env.BACKUPS_DIR || "./backups",
	downloadsDir: Bun.env.DOWNLOADS_DIR || "./generated/downloads",
	googleTokenFile: Bun.env.GOOGLE_TOKEN_FILE || "./secrets/credentials.json",
	timezone:
		Bun.env.TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone,
	serverName,
	systemPrompt,
	defaultCurrency,
};
