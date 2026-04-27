import { Database } from "bun:sqlite";
import {
  getOrCreateProject,
  getProject,
  saveProjectMetadata,
  dbGetProjectMetadata,
  getPatterns,
  getDecisionsFromDB,
  listSnapshots,
} from "./client.js";

export async function createOrGetProject(
  db: Database,
  args: {
    projectId: string;
    projectName: string;
    description?: string;
    owner?: string;
  }
): Promise<Record<string, unknown>> {
  const { projectId, projectName, description, owner } = args;

  const result = getOrCreateProject(db, projectId, projectName, description, owner);

  return {
    projectId: result["id"],
    projectName: result["name"],
    created: result["created"],
    createdAt: result["created_at"],
  };
}

export async function saveArchitecture(
  db: Database,
  args: {
    projectId: string;
    architecture?: unknown;
    stack?: unknown;
    envTemplate?: unknown;
  }
): Promise<Record<string, unknown>> {
  const { projectId, architecture, stack, envTemplate } = args;

  const project = getProject(db, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  saveProjectMetadata(db, projectId, architecture, stack, envTemplate);

  return { projectId, saved: true };
}

export async function getProjectSummary(
  db: Database,
  args: {
    projectId: string;
    includePatterns?: boolean;
    includeDecisions?: boolean;
    includeSessions?: boolean;
  }
): Promise<Record<string, unknown>> {
  const {
    projectId,
    includePatterns = true,
    includeDecisions = true,
    includeSessions = true,
  } = args;

  const project = getProject(db, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const metadata = dbGetProjectMetadata(db, projectId);

  const result: Record<string, unknown> = {
    projectId,
    projectName: project["name"],
    description: project["description"],
    owner: project["owner"],
    createdAt: project["created_at"],
  };

  if (metadata) {
    result["architecture"] = metadata["architecture"];
    result["stack"] = metadata["stack"];
    result["envTemplate"] = metadata["envTemplate"];
  }

  if (includePatterns) result["codePatterns"] = getPatterns(db, projectId);
  if (includeDecisions) result["architecturalDecisions"] = getDecisionsFromDB(db, projectId);
  if (includeSessions) result["recentSessions"] = listSnapshots(db, projectId, 5);

  return result;
}
