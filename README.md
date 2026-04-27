# handoff-mcp

MCP server that acts as a **shared memory hub** across multiple LLMs (Claude, Gemini, Copilot, Codex). Any agent entering a project immediately understands its architecture, patterns, and decisions — and can pick up exactly where the previous LLM left off.

## Tools

| Tool | Description |
|---|---|
| `create_or_get_project` | Initialize or retrieve a project |
| `save_architecture` | Save architecture overview and tech stack |
| `get_project_summary` | Full project overview — perfect as first call |
| `save_context_snapshot` | Save working state before handing off |
| `get_context_snapshot` | Retrieve what the previous LLM was doing |
| `list_sessions` | List all saved sessions |
| `save_code_pattern` | Save reusable code patterns (JWT, FCM, etc.) |
| `get_code_patterns` | Retrieve patterns by category/language |
| `save_architectural_decision` | Save an ADR (why a decision was made) |
| `get_decisions` | Retrieve architectural decisions |
| `search_context` | Search across patterns, decisions, and snapshots |

## Install

**Requirements:** [Bun](https://bun.sh)

```bash
git clone https://github.com/Juan-Severiano/handoff-mcp
cd handoff-mcp
bun install
```

## Configure

Replace `/path/to/handoff-mcp` with the absolute path where you cloned the repo.

### Claude Desktop

File: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "handoff-mcp": {
      "command": "bun",
      "args": ["/path/to/handoff-mcp/src/index.ts"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add handoff-mcp bun /path/to/handoff-mcp/src/index.ts
```

### Gemini CLI

File: `~/.gemini/settings.json`

```json
{
  "mcpServers": {
    "handoff-mcp": {
      "command": "bun",
      "args": ["/path/to/handoff-mcp/src/index.ts"]
    }
  }
}
```

### GitHub Copilot (VS Code)

File: `.vscode/mcp.json` in your workspace, or VS Code user `settings.json`:

```json
{
  "servers": {
    "handoff-mcp": {
      "type": "stdio",
      "command": "bun",
      "args": ["/path/to/handoff-mcp/src/index.ts"]
    }
  }
}
```

### OpenAI Codex CLI

File: `~/.codex/config.yaml`

```yaml
mcpServers:
  handoff-mcp:
    command: bun
    args:
      - /path/to/handoff-mcp/src/index.ts
```

### DB path (optional)

By default, `context.db` is created in the working directory. Override via env var:

```json
{
  "mcpServers": {
    "handoff-mcp": {
      "command": "bun",
      "args": ["/path/to/handoff-mcp/src/index.ts"],
      "env": { "DB_PATH": "/your/shared/path/context.db" }
    }
  }
}
```

> Tip: point all LLMs to the same `DB_PATH` so they share one database across tools.

## Flow

```
Claude works on the project
→ create_or_get_project("my-app")
→ save_architecture({ description: "React Native + Spring Boot" })

Claude runs low on tokens
→ save_context_snapshot({
    llmModel: "claude-opus-4",
    taskDescription: "Implementing push notifications",
    recentChanges: "FCM handler done",
    nextSteps: "Wire up Foreground Service, test Android 16"
  })

Gemini takes over
→ get_project_summary("my-app")      # full context in one call
→ get_context_snapshot("my-app")     # picks up exactly where Claude stopped
→ continues...
```

## Dev

```bash
bun run dev      # watch mode
bun run inspect  # MCP Inspector
bun run build    # compile to dist/
```
