import { Database } from "bun:sqlite";
import {
  saveSnapshot,
  getLatestSnapshot,
  getSnapshotBySessionId,
  listSnapshots,
  getCurrentTimestamp,
} from "./client.js";

export async function saveContextSnapshot(
  db: Database,
  args: {
    projectId: string;
    sessionId?: string;
    llmModel: string;
    taskDescription: string;
    nextSteps: string;
    currentFile?: string;
    recentChanges?: string;
    codeContext?: { language: string; snippet: string; lineRange?: string };
    tokenUsage?: { inputTokens: number; outputTokens: number };
  }
): Promise<Record<string, unknown>> {
  const {
    projectId, sessionId, llmModel, taskDescription, nextSteps,
    currentFile, recentChanges, codeContext, tokenUsage,
  } = args;

  const sid = sessionId ?? `session-${Date.now()}`;

  saveSnapshot(db, projectId, sid, llmModel, taskDescription, nextSteps, {
    currentFile,
    recentChanges,
    codeContext,
    tokenUsage,
  });

  return {
    sessionId: sid,
    saved: true,
    timestamp: getCurrentTimestamp(),
    message: `Snapshot saved for ${llmModel}. The next LLM can continue from this point.`,
  };
}

export async function getContextSnapshot(
  db: Database,
  args: {
    projectId: string;
    sessionId?: string;
    llmFilter?: string;
    limit?: number;
  }
): Promise<Record<string, unknown>> {
  const { projectId, sessionId, llmFilter, limit = 5 } = args;

  const snapshot = sessionId
    ? getSnapshotBySessionId(db, projectId, sessionId)
    : getLatestSnapshot(db, projectId, llmFilter);

  if (!snapshot) {
    return { found: false, message: "No context snapshot found for this project." };
  }

  const allSessions = listSnapshots(db, projectId, limit);

  return {
    found: true,
    currentSnapshot: snapshot,
    recentSessions: allSessions.filter((s) => s["sessionId"] !== snapshot["sessionId"]),
    instructions:
      "Use 'currentSnapshot.nextSteps' to know exactly what to do next. " +
      "'recentChanges' shows what was done last.",
  };
}

export async function listSessions(
  db: Database,
  args: { projectId: string; limit?: number }
): Promise<Record<string, unknown>> {
  const { projectId, limit = 10 } = args;

  const sessions = listSnapshots(db, projectId, limit);

  return {
    projectId,
    count: sessions.length,
    sessions: sessions.map((s) => ({
      sessionId: s["sessionId"],
      llmModel: s["llmModel"],
      taskDescription: s["taskDescription"],
      createdAt: s["createdAt"],
      nextStepsSummary:
        typeof s["nextSteps"] === "string"
          ? s["nextSteps"].substring(0, 120) + (s["nextSteps"].length > 120 ? "…" : "")
          : "",
    })),
  };
}
