import { Database } from "bun:sqlite";
import { saveDecision, getDecisionsFromDB } from "./client.js";

const VALID_STATUSES = ["proposed", "accepted", "deprecated", "superseded"] as const;
type DecisionStatus = typeof VALID_STATUSES[number];

export async function saveArchitecturalDecision(
  db: Database,
  args: {
    projectId: string;
    title: string;
    status: DecisionStatus;
    context: string;
    decision: string;
    consequences: string;
    alternatives?: string;
  }
): Promise<Record<string, unknown>> {
  const { projectId, title, status, context, decision, consequences, alternatives } = args;

  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`status must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  const decisionId = saveDecision(db, projectId, title, status, context, decision, consequences, alternatives);

  return {
    decisionId,
    title,
    status,
    saved: true,
    message: `Decision '${title}' saved with status '${status}'.`,
  };
}

export async function getDecisions(
  db: Database,
  args: { projectId: string; status?: string }
): Promise<Record<string, unknown>> {
  const { projectId, status } = args;

  const decisions = getDecisionsFromDB(db, projectId, status);

  return {
    projectId,
    filters: { status },
    count: decisions.length,
    decisions,
  };
}
