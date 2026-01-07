# Personal Assistant MCP Server

A customizable MCP server for goals, ideas, calendar, notes, and drawings. Fork this repository and customize it to create your own personalized assistant.

## Getting Started

1. **Fork or clone this repository**

2. **Customize your assistant**:
   - Edit `config.ts` and customize:
     - `serverName`: Your assistant's name (used in MCP registration and resource URIs)
     - `systemPrompt`: Your assistant's personality and behavior
     - `defaultCurrency`: Default currency for financial goals
   - (Optional) Update `package.json` name field if you want to change the package name

3. **Configure in Cursor**:

Add to Cursor settings (`Cmd/Ctrl + ,` → MCP):

```json
{
  "mcpServers": {
    "your-assistant-name": {
      "command": "bun",
      "args": ["/path/to/your-assistant/index.ts"],
      "cwd": "/path/to/your-assistant",
      "env": {
        "GOOGLE_CLIENT_ID": "your-google-client-id",
        "GOOGLE_CLIENT_SECRET": "your-google-client-secret"
      }
    }
  }
}
```

> **Note**: Replace `your-assistant-name` with the `serverName` from your `config.ts`, and `/path/to/your-assistant` with the actual path to your repository. You can use `$PWD` or an absolute path.

## Tools

### State Management
- **`capture_thought`** - Capture temporary ideas/thoughts (use any category string you want)
- **`cleanup_state`** - Remove outdated goals/ideas based on configurable criteria (creates timestamped backup)
- **`manage_goal`** - Create/update/delete OKR goals with Google Calendar integration (use any category string)
- **`manage_profile`** - Manage persistent profile (achievements, skills, preferences, knowledge, facts, history)
- **`view_status`** - View goals, ideas, and profile data

### Calendar
- **`check_schedule`** - Get upcoming Google Calendar events and current goals
- **`manage_event`** - Create/update/delete Google Calendar events

### Notes (Obsidian)
- **`list_notes`** - List all notes with metadata
- **`manage_note`** - Create/update/delete notes
- **`view_note`** - View specific note content

### Drawings (Excalidraw)
- **`list_drawings`** - List all Excalidraw drawings
- **`manage_drawings`** - Create/update/delete Excalidraw drawings

### Media (YouTube/yt-dlp)
- **`download_media`** - Download videos or audio from YouTube and other supported sites using yt-dlp. Supports configurable quality, format options (video/audio/both), and custom output paths. Downloads are stored in the configured downloads directory.

### System
- **`health_check`** - Check server health and validate state/profile

## Resources

- **`{serverName}://memory/profile`** - Persistent profile layer (YAML) - survives state rotations
- **`{serverName}://memory/state`** - Active memory state (YAML) - goals, ideas, settings

> Replace `{serverName}` with your configured server name from `config.ts`

## Data Storage

- `generated/state.yaml` - Active state (goals, ideas)
- `generated/profile.yaml` - Persistent profile (achievements, skills, etc.)
- `generated/changelog.txt` - Activity log
- `generated/designs/` - Excalidraw drawings
- `generated/notes/` - Obsidian vault
- `generated/downloads/` - Downloaded media files (videos/audio)
- `backups/` - Timestamped state backups from cleanup operations

## Configuration

### User Configuration (`config.ts`)

Customize your assistant by editing `config.ts` directly:
- `serverName` - Your assistant's name (used in MCP registration and resource URIs)
- `systemPrompt` - Your assistant's personality and behavior
- `defaultCurrency` - Default currency for financial goals (e.g., "USD", "EUR")

### Environment Variables

Environment variables (defaults in `config.ts`):
- `STATE_FILE` - State file path
- `PROFILE_FILE` - Profile file path
- `LOG_FILE` - Changelog path
- `DESIGNS_DIR` - Drawings directory
- `OBSIDIAN_VAULT` - Notes vault path
- `DOWNLOADS_DIR` - Media downloads directory
- `BACKUPS_DIR` - Backups directory
- `GOOGLE_TOKEN_FILE` - Google OAuth credentials path

## Scripts

- `bun run authenticate` - manually authenticate with Google (MCP can automatically authenticates when needed)
- `bun run cleanup` - manually reset state and create a backup (MCP can call this internally)
