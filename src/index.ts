import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Database } from "bun:sqlite";
import { initializeDatabase } from "./client.js";
import { createOrGetProject, getProjectSummary, saveArchitecture } from "./projects.js";
import { saveContextSnapshot, getContextSnapshot, listSessions } from "./snapshots.js";
import { saveCodePattern, getCodePatterns } from "./patterns.js";
import { saveArchitecturalDecision, getDecisions } from "./decisions.js";
import { searchContext } from "./search.js";

const dbPath = process.env.DB_PATH ?? "context.db";
const db = new Database(dbPath, { create: true });
initializeDatabase(db);

const server = new McpServer({ name: "handoff-mcp", version: "1.0.0" });

// ─────────────────────────────────────────────────────────────────────────────
// Project management
// ─────────────────────────────────────────────────────────────────────────────

server.registerTool(
  "create_or_get_project",
  {
    title: "Create or Get Project",
    description:
      "Initialize or retrieve a project in the context hub. " +
      "Call this first when starting work on any project. Returns the project details and whether it was newly created.",
    inputSchema: {
      projectId: z.string().min(1).describe("Unique slug for the project (e.g. 'ja-pediu-delivery')"),
      projectName: z.string().min(1).describe("Human-readable project name"),
      description: z.string().optional().describe("Optional project description"),
      owner: z.string().optional().describe("Optional owner name"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  async (args) => {
    const result = await createOrGetProject(db, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "save_architecture",
  {
    title: "Save Architecture & Stack",
    description:
      "Save or update the project's architecture overview, technology stack, and environment template. " +
      "Call this when you learn the project structure so future LLMs understand it immediately.",
    inputSchema: {
      projectId: z.string().describe("Project ID"),
      architecture: z
        .object({
          description: z.string().describe("e.g. 'React Native + Spring Boot + PostgreSQL'"),
          layers: z
            .object({
              frontend: z.object({ tech: z.string(), path: z.string() }).optional(),
              backend: z.object({ tech: z.string(), path: z.string() }).optional(),
              mobile: z.object({ tech: z.string(), path: z.string() }).optional(),
            })
            .optional(),
          databases: z.array(z.string()).optional(),
          externalServices: z.array(z.string()).optional(),
          notes: z.string().optional(),
        })
        .optional()
        .describe("Architecture overview"),
      stack: z
        .object({
          dependencies: z
            .array(
              z.object({
                name: z.string(),
                version: z.string(),
                category: z.string().describe("e.g. 'mobile', 'backend', 'infra'"),
              })
            )
            .optional(),
          notes: z.string().optional(),
        })
        .optional()
        .describe("Technology stack details"),
      envTemplate: z
        .record(z.string())
        .optional()
        .describe("Env variable names (no values) e.g. { DATABASE_URL: '', JWT_SECRET: '' }"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  async (args) => {
    const result = await saveArchitecture(db, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "get_project_summary",
  {
    title: "Get Project Summary",
    description:
      "Get a complete overview of the project: architecture, stack, patterns, decisions, and recent sessions. " +
      "Perfect starting point for any LLM entering the project.",
    inputSchema: {
      projectId: z.string().describe("Project ID"),
      includePatterns: z.boolean().default(true).describe("Include code patterns"),
      includeDecisions: z.boolean().default(true).describe("Include architectural decisions"),
      includeSessions: z.boolean().default(true).describe("Include recent sessions"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  async (args) => {
    const result = await getProjectSummary(db, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Context snapshots (LLM handoff)
// ─────────────────────────────────────────────────────────────────────────────

server.registerTool(
  "save_context_snapshot",
  {
    title: "Save Context Snapshot",
    description:
      "Save the current working state so another LLM can pick up exactly where you left off. " +
      "Call this proactively as you work and always before your context runs out. " +
      "If you use the same sessionId again, the snapshot is updated in place.",
    inputSchema: {
      projectId: z.string().describe("Project ID"),
      sessionId: z
        .string()
        .optional()
        .describe("Session ID — reuse the same ID to update this session's state"),
      llmModel: z
        .string()
        .describe("Model doing the work (e.g. 'claude-opus-4', 'gemini-2.5-pro', 'gpt-4o')"),
      taskDescription: z.string().describe("What is currently being worked on"),
      recentChanges: z
        .string()
        .optional()
        .describe("Summary of what was just done / implemented"),
      nextSteps: z.string().describe("Exactly what the next LLM should do to continue"),
      currentFile: z.string().optional().describe("File being edited, if any"),
      codeContext: z
        .object({
          language: z.string(),
          snippet: z.string().describe("Relevant code snippet"),
          lineRange: z.string().optional().describe("e.g. '45-120'"),
        })
        .optional()
        .describe("Code context for the next LLM"),
      tokenUsage: z
        .object({ inputTokens: z.number(), outputTokens: z.number() })
        .optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  async (args) => {
    const result = await saveContextSnapshot(db, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "get_context_snapshot",
  {
    title: "Get Context Snapshot",
    description:
      "Retrieve the most recent (or specific) context snapshot for a project. " +
      "Use this when taking over from another LLM — it tells you exactly what was done and what to do next.",
    inputSchema: {
      projectId: z.string().describe("Project ID"),
      sessionId: z.string().optional().describe("Specific session ID, or omit for the latest"),
      llmFilter: z
        .string()
        .optional()
        .describe("Only return snapshots from this LLM model"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(5)
        .describe("Number of recent sessions to include alongside the main snapshot"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  async (args) => {
    const result = await getContextSnapshot(db, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "list_sessions",
  {
    title: "List Sessions",
    description: "List all saved sessions for a project with their LLM, timestamp, and task summary.",
    inputSchema: {
      projectId: z.string().describe("Project ID"),
      limit: z.number().int().min(1).max(50).default(10).describe("Number of sessions to return"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  async (args) => {
    const result = await listSessions(db, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Code patterns
// ─────────────────────────────────────────────────────────────────────────────

server.registerTool(
  "save_code_pattern",
  {
    title: "Save Code Pattern",
    description:
      "Save a reusable code pattern or template (e.g. JWT interceptor, FCM handler, error boundaries). " +
      "Saves over an existing pattern with the same name if one exists.",
    inputSchema: {
      projectId: z.string().describe("Project ID"),
      patternName: z.string().describe("Unique pattern name (e.g. 'jwt-interceptor')"),
      category: z
        .string()
        .describe("Category: 'react', 'react-native', 'spring', 'flutter', 'utils', 'testing'"),
      language: z.string().describe("e.g. 'typescript', 'java', 'dart', 'kotlin'"),
      code: z.string().describe("The actual code"),
      description: z.string().optional().describe("What this pattern does"),
      exampleUsage: z.string().optional().describe("How to use it"),
      relatedPatterns: z.array(z.string()).optional().describe("Names of related patterns"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  async (args) => {
    const result = await saveCodePattern(db, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "get_code_patterns",
  {
    title: "Get Code Patterns",
    description:
      "Retrieve code patterns for a project, optionally filtered by category, language, or keyword search.",
    inputSchema: {
      projectId: z.string().describe("Project ID"),
      category: z.string().optional().describe("Filter by category"),
      language: z.string().optional().describe("Filter by language"),
      search: z.string().optional().describe("Search by name or description"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  async (args) => {
    const result = await getCodePatterns(db, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Architectural decisions (ADRs)
// ─────────────────────────────────────────────────────────────────────────────

server.registerTool(
  "save_architectural_decision",
  {
    title: "Save Architectural Decision",
    description:
      "Save an Architecture Decision Record (ADR). Documents WHY a technical choice was made — " +
      "critical for future LLMs to understand constraints without repeating past analysis.",
    inputSchema: {
      projectId: z.string().describe("Project ID"),
      title: z.string().describe("Short decision title"),
      status: z
        .enum(["proposed", "accepted", "deprecated", "superseded"])
        .describe("Decision status"),
      context: z.string().describe("Why was this decision needed? What problem does it solve?"),
      decision: z.string().describe("What was decided?"),
      consequences: z.string().describe("What are the implications — positive and negative?"),
      alternatives: z.string().optional().describe("Alternatives considered and why they were rejected"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  async (args) => {
    const result = await saveArchitecturalDecision(db, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "get_decisions",
  {
    title: "Get Architectural Decisions",
    description: "Retrieve architectural decisions (ADRs) for a project, optionally filtered by status.",
    inputSchema: {
      projectId: z.string().describe("Project ID"),
      status: z
        .enum(["proposed", "accepted", "deprecated", "superseded"])
        .optional()
        .describe("Filter by status"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  async (args) => {
    const result = await getDecisions(db, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────────────────────

server.registerTool(
  "search_context",
  {
    title: "Search Context",
    description:
      "Full-text search across patterns, decisions, and snapshots. " +
      "Use this to find relevant prior work before implementing something new.",
    inputSchema: {
      projectId: z.string().describe("Project ID"),
      query: z.string().min(1).describe("Search terms"),
      type: z
        .enum(["pattern", "decision", "snapshot", "all"])
        .default("all")
        .describe("Scope of search"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe("Max results to return"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  async (args) => {
    const result = await searchContext(db, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Context Hub MCP running on stdio — db:", dbPath);
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
