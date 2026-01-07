import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "./config.ts";
import { initializeGenerated } from "./lib/utils/init.ts";
import { registerMemoryProfileResource } from "./resources/memory-profile.ts";
import { registerMemoryStateResource } from "./resources/memory-state.ts";
import { registerListEvents } from "./tools/calendar/list-events.ts";
import { registerManageCalendarEvent } from "./tools/calendar/manage-event.ts";
import { registerCleanupState } from "./tools/cleanup-state.ts";
import { registerListDrawings } from "./tools/excalidraw/list-drawings.ts";
import { registerManageDrawings } from "./tools/excalidraw/manage-drawings.ts";
import { registerGetDate } from "./tools/get-date.ts";
import { registerHealthCheck } from "./tools/health-check.ts";
import { registerListNotes } from "./tools/obsidian/list-notes.ts";
import { registerManageNote } from "./tools/obsidian/manage-note.ts";
import { registerViewNote } from "./tools/obsidian/view-note.ts";
import { registerListShortcuts } from "./tools/shortcuts/list-shortcuts.ts";
import { registerRunShortcut } from "./tools/shortcuts/run-shortcut.ts";
import { registerCaptureThought } from "./tools/user/capture-thought.ts";
import { registerManageGoal } from "./tools/user/manage-goal.ts";
import { registerManageProfile } from "./tools/user/manage-profile.ts";
import { registerViewStatus } from "./tools/user/view-status.ts";
import { registerDownloadMedia } from "./tools/ytdlp/download.ts";

const server = new McpServer({
	name: config.serverName,
	version: "1.0.0",
});

await initializeGenerated();

registerHealthCheck(server);
registerGetDate(server);
registerMemoryStateResource(server);
registerMemoryProfileResource(server);
registerCaptureThought(server);
registerCleanupState(server);
registerManageDrawings(server);
registerListDrawings(server);
registerManageGoal(server);
registerManageProfile(server);
registerViewStatus(server);
registerManageNote(server);
registerListNotes(server);
registerViewNote(server);
registerDownloadMedia(server);
registerListEvents(server);
registerManageCalendarEvent(server);
registerRunShortcut(server);
registerListShortcuts(server);

const transport = new StdioServerTransport();
await server.connect(transport);
// Server initialized - do not log to stdout as it breaks MCP protocol
