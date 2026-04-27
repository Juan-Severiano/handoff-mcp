import { Database } from "bun:sqlite";
import { getPatterns, getDecisionsFromDB, listSnapshots } from "./client.js";

export async function searchContext(
  db: Database,
  args: {
    projectId: string;
    query: string;
    type?: "pattern" | "decision" | "snapshot" | "all";
    limit?: number;
  }
): Promise<Record<string, unknown>> {
  const { projectId, query, type = "all", limit = 10 } = args;

  const q = query.toLowerCase();
  const results: Array<{ type: string; title: string; excerpt: string; data: unknown }> = [];

  if (type === "all" || type === "pattern") {
    getPatterns(db, projectId)
      .filter(
        (p) =>
          (p["patternName"] as string).toLowerCase().includes(q) ||
          ((p["description"] as string | undefined) ?? "").toLowerCase().includes(q) ||
          (p["code"] as string).toLowerCase().includes(q)
      )
      .forEach((p) => {
        results.push({
          type: "pattern",
          title: p["patternName"] as string,
          excerpt: `[${p["category"]}/${p["language"]}] ${p["description"] ?? ""}`.substring(0, 150),
          data: p,
        });
      });
  }

  if (type === "all" || type === "decision") {
    getDecisionsFromDB(db, projectId)
      .filter(
        (d) =>
          (d["title"] as string).toLowerCase().includes(q) ||
          (d["decision"] as string).toLowerCase().includes(q) ||
          (d["context"] as string).toLowerCase().includes(q)
      )
      .forEach((d) => {
        results.push({
          type: "decision",
          title: d["title"] as string,
          excerpt: `[${d["status"]}] ${d["decision"]}`.substring(0, 150),
          data: d,
        });
      });
  }

  if (type === "all" || type === "snapshot") {
    listSnapshots(db, projectId, 20)
      .filter(
        (s) =>
          (s["taskDescription"] as string).toLowerCase().includes(q) ||
          ((s["recentChanges"] as string | undefined) ?? "").toLowerCase().includes(q) ||
          (s["nextSteps"] as string).toLowerCase().includes(q)
      )
      .forEach((s) => {
        results.push({
          type: "snapshot",
          title: `[${s["llmModel"]}] ${s["taskDescription"]}`,
          excerpt: `Next: ${(s["nextSteps"] as string).substring(0, 100)}`,
          data: s,
        });
      });
  }

  const limited = results.slice(0, limit);

  return {
    projectId,
    query,
    totalResults: limited.length,
    results: limited,
    tip: limited.length === 0 ? "No results. Try broader keywords." : undefined,
  };
}
