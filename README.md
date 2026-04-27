# context-hub-mcp

MCP server that acts as a **shared memory hub** across multiple LLMs (Claude, Gemini, Copilot). Any agent entering a project immediately understands its architecture, patterns, and decisions — and can pick up exactly where the previous LLM left off.

## Tools

| Tool | Description |
|---|---|
| `create_or_get_project` | Initialize or retrieve a project |
| `save_architecture` | Save architecture overview and tech stack |
| `get_project_summary` | Full project overview (perfect as first call) |
| `save_context_snapshot` | Save current working state before handing off |
| `get_context_snapshot` | Retrieve what the previous LLM was doing |
| `list_sessions` | List all saved sessions |
| `save_code_pattern` | Save reusable code patterns (JWT, FCM, etc.) |
| `get_code_patterns` | Retrieve patterns by category/language |
| `save_architectural_decision` | Save an ADR (why a decision was made) |
| `get_decisions` | Retrieve architectural decisions |
| `search_context` | Search across patterns, decisions, and snapshots |

## Setup

**Requirements:** [Bun](https://bun.sh)

```bash
git clone https://github.com/your-username/context-hub-mcp
cd context-hub-mcp
bun install
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "context-hub": {
      "command": "bun",
      "args": ["/path/to/context-hub-mcp/src/index.ts"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add context-hub bun /path/to/context-hub-mcp/src/index.ts
```

### DB path (optional)

By default, `context.db` is created in the working directory. Override with:

```bash
DB_PATH=/your/path/context.db bun src/index.ts
```

## Typical flow

```
# Claude starts working on a project
→ create_or_get_project("ja-pediu-delivery")
→ save_architecture({ stack: "React Native + Spring Boot + PostgreSQL" })

# Claude runs low on tokens → saves state
→ save_context_snapshot({
    llmModel: "claude-opus-4",
    taskDescription: "Implementing Android Live Updates",
    recentChanges: "FCM + RemoteViews done",
    nextSteps: "Implement Foreground Service, test on Android 16"
  })

# Gemini takes over
→ get_project_summary("ja-pediu-delivery")   # understands everything
→ get_context_snapshot("ja-pediu-delivery")  # picks up exactly where Claude stopped
→ continues...
```

## Dev

```bash
bun run dev      # watch mode
bun run inspect  # MCP Inspector at localhost:5173
bun run build    # compile to dist/
```
