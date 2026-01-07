import { config } from "@/config.ts";
import { resolvePath } from "./path.ts";

const LOG_FILE = Bun.file(resolvePath(config.logFile));

export const log = async (
	level: "info" | "warn" | "error",
	tool: string,
	req: unknown,
	res: string,
) => {
	const timestamp = new Date().toISOString();
	const logEntry = `[${level}] [${timestamp}] ${tool}\n  req: ${JSON.stringify(req)}\n  res: ${res}\n\n`;
	const existingLog = await LOG_FILE.text().catch(() => "");
	await Bun.write(LOG_FILE, existingLog + logEntry);
};
