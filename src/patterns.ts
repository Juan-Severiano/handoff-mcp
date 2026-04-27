import { Database } from "bun:sqlite";
import { savePattern, getPatterns as dbGetPatterns } from "./client.js";

export async function saveCodePattern(
  db: Database,
  args: {
    projectId: string;
    patternName: string;
    category: string;
    language: string;
    code: string;
    description?: string;
    exampleUsage?: string;
    relatedPatterns?: string[];
  }
): Promise<Record<string, unknown>> {
  const { projectId, patternName, category, language, code, description, exampleUsage, relatedPatterns } = args;

  savePattern(db, projectId, patternName, category, language, code, {
    description,
    exampleUsage,
    relatedPatterns,
  });

  return {
    patternName,
    category,
    language,
    saved: true,
    message: `Pattern '${patternName}' saved successfully.`,
  };
}

export async function getCodePatterns(
  db: Database,
  args: {
    projectId: string;
    category?: string;
    language?: string;
    search?: string;
  }
): Promise<Record<string, unknown>> {
  const { projectId, category, language, search } = args;

  let patterns = dbGetPatterns(db, projectId, category, language);

  if (search) {
    const q = search.toLowerCase();
    patterns = patterns.filter(
      (p) =>
        (p["patternName"] as string).toLowerCase().includes(q) ||
        (p["description"] && (p["description"] as string).toLowerCase().includes(q))
    );
  }

  return {
    projectId,
    filters: { category, language, search },
    count: patterns.length,
    patterns,
  };
}
