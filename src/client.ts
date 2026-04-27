import { Database, type SQLQueryBindings } from "bun:sqlite";

type AnyRow = Record<string, unknown>;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  llm_model TEXT NOT NULL,
  task_description TEXT NOT NULL,
  current_file TEXT,
  recent_changes TEXT,
  next_steps TEXT NOT NULL,
  code_context_json TEXT,
  token_usage_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_project ON snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_llm ON snapshots(project_id, llm_model);
CREATE INDEX IF NOT EXISTS idx_snapshots_created ON snapshots(created_at DESC);

CREATE TABLE IF NOT EXISTS code_patterns (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  pattern_name TEXT NOT NULL,
  category TEXT NOT NULL,
  language TEXT NOT NULL,
  description TEXT,
  code TEXT NOT NULL,
  example_usage TEXT,
  related_patterns_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, pattern_name)
);

CREATE INDEX IF NOT EXISTS idx_patterns_project ON code_patterns(project_id);
CREATE INDEX IF NOT EXISTS idx_patterns_category ON code_patterns(project_id, category);
CREATE INDEX IF NOT EXISTS idx_patterns_language ON code_patterns(project_id, language);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  context TEXT NOT NULL,
  decision TEXT NOT NULL,
  consequences TEXT NOT NULL,
  alternatives TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(project_id, status);

CREATE TABLE IF NOT EXISTS project_metadata (
  project_id TEXT PRIMARY KEY,
  architecture_json TEXT,
  stack_json TEXT,
  env_template_json TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

PRAGMA user_version = 1;
`;

export function initializeDatabase(db: Database): void {
  db.exec(SCHEMA_SQL);
  console.error("Database initialized");
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

export function getOrCreateProject(
  db: Database,
  projectId: string,
  projectName: string,
  description?: string,
  owner?: string
): AnyRow {
  const existing = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as AnyRow | null;
  if (existing) return { ...existing, created: false };

  db.prepare(
    "INSERT INTO projects (id, name, description, owner) VALUES (?, ?, ?, ?)"
  ).run(projectId, projectName, description ?? null, owner ?? null);

  return { id: projectId, name: projectName, description, owner, created: true };
}

export function getProject(db: Database, projectId: string): AnyRow | null {
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as AnyRow | null;
}

export function saveProjectMetadata(
  db: Database,
  projectId: string,
  architecture?: unknown,
  stack?: unknown,
  envTemplate?: unknown
): void {
  const existing = db
    .prepare("SELECT project_id FROM project_metadata WHERE project_id = ?")
    .get(projectId);

  const now = getCurrentTimestamp();
  const archJson = architecture ? JSON.stringify(architecture) : null;
  const stackJson = stack ? JSON.stringify(stack) : null;
  const envJson = envTemplate ? JSON.stringify(envTemplate) : null;

  if (existing) {
    db.prepare(`
      UPDATE project_metadata
      SET architecture_json = COALESCE(?, architecture_json),
          stack_json = COALESCE(?, stack_json),
          env_template_json = COALESCE(?, env_template_json),
          updated_at = ?
      WHERE project_id = ?
    `).run(archJson, stackJson, envJson, now, projectId);
  } else {
    db.prepare(`
      INSERT INTO project_metadata (project_id, architecture_json, stack_json, env_template_json)
      VALUES (?, ?, ?, ?)
    `).run(projectId, archJson, stackJson, envJson);
  }
}

export function dbGetProjectMetadata(db: Database, projectId: string): AnyRow | null {
  const row = db
    .prepare("SELECT * FROM project_metadata WHERE project_id = ?")
    .get(projectId) as AnyRow | null;
  if (!row) return null;

  return {
    architecture: row.architecture_json ? JSON.parse(row.architecture_json as string) : null,
    stack: row.stack_json ? JSON.parse(row.stack_json as string) : null,
    envTemplate: row.env_template_json ? JSON.parse(row.env_template_json as string) : null,
    updatedAt: row.updated_at,
  };
}

export function saveSnapshot(
  db: Database,
  projectId: string,
  sessionId: string,
  llmModel: string,
  taskDescription: string,
  nextSteps: string,
  data: {
    currentFile?: string;
    recentChanges?: string;
    codeContext?: unknown;
    tokenUsage?: unknown;
  }
): void {
  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(`
    INSERT INTO snapshots
    (id, project_id, session_id, llm_model, task_description, current_file,
     recent_changes, next_steps, code_context_json, token_usage_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, session_id) DO UPDATE SET
      llm_model = excluded.llm_model,
      task_description = excluded.task_description,
      current_file = excluded.current_file,
      recent_changes = excluded.recent_changes,
      next_steps = excluded.next_steps,
      code_context_json = excluded.code_context_json,
      token_usage_json = excluded.token_usage_json,
      created_at = excluded.created_at
  `).run(
    id, projectId, sessionId, llmModel, taskDescription,
    data.currentFile ?? null,
    data.recentChanges ?? null,
    nextSteps,
    data.codeContext ? JSON.stringify(data.codeContext) : null,
    data.tokenUsage ? JSON.stringify(data.tokenUsage) : null,
    now
  );
}

function parseSnapshot(row: AnyRow): AnyRow {
  return {
    id: row.id,
    sessionId: row.session_id,
    llmModel: row.llm_model,
    taskDescription: row.task_description,
    currentFile: row.current_file,
    recentChanges: row.recent_changes,
    nextSteps: row.next_steps,
    codeContext: row.code_context_json ? JSON.parse(row.code_context_json as string) : null,
    tokenUsage: row.token_usage_json ? JSON.parse(row.token_usage_json as string) : null,
    createdAt: row.created_at,
  };
}

export function getLatestSnapshot(db: Database, projectId: string, llmFilter?: string): AnyRow | null {
  const sql = llmFilter
    ? "SELECT * FROM snapshots WHERE project_id = ? AND llm_model = ? ORDER BY created_at DESC LIMIT 1"
    : "SELECT * FROM snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT 1";

  const row = llmFilter
    ? (db.prepare(sql).get(projectId, llmFilter) as AnyRow | null)
    : (db.prepare(sql).get(projectId) as AnyRow | null);

  return row ? parseSnapshot(row) : null;
}

export function getSnapshotBySessionId(db: Database, projectId: string, sessionId: string): AnyRow | null {
  const row = db
    .prepare("SELECT * FROM snapshots WHERE project_id = ? AND session_id = ?")
    .get(projectId, sessionId) as AnyRow | null;
  return row ? parseSnapshot(row) : null;
}

export function listSnapshots(db: Database, projectId: string, limit = 10): AnyRow[] {
  const rows = db
    .prepare("SELECT * FROM snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(projectId, limit) as AnyRow[];
  return rows.map(parseSnapshot);
}

export function savePattern(
  db: Database,
  projectId: string,
  patternName: string,
  category: string,
  language: string,
  code: string,
  data: { description?: string; exampleUsage?: string; relatedPatterns?: string[] }
): void {
  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(`
    INSERT INTO code_patterns
    (id, project_id, pattern_name, category, language, description,
     code, example_usage, related_patterns_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, pattern_name) DO UPDATE SET
      category = excluded.category,
      language = excluded.language,
      description = excluded.description,
      code = excluded.code,
      example_usage = excluded.example_usage,
      related_patterns_json = excluded.related_patterns_json,
      updated_at = excluded.updated_at
  `).run(
    id, projectId, patternName, category, language,
    data.description ?? null,
    code,
    data.exampleUsage ?? null,
    data.relatedPatterns ? JSON.stringify(data.relatedPatterns) : null,
    now, now
  );
}

export function getPatterns(db: Database, projectId: string, category?: string, language?: string): AnyRow[] {
  let sql = "SELECT * FROM code_patterns WHERE project_id = ?";
  const params: SQLQueryBindings[] = [projectId];

  if (category) { sql += " AND category = ?"; params.push(category); }
  if (language) { sql += " AND language = ?"; params.push(language); }
  sql += " ORDER BY created_at DESC";

  const rows = db.prepare(sql).all(...params) as AnyRow[];
  return rows.map((row) => ({
    id: row.id,
    patternName: row.pattern_name,
    category: row.category,
    language: row.language,
    description: row.description,
    code: row.code,
    exampleUsage: row.example_usage,
    relatedPatterns: row.related_patterns_json ? JSON.parse(row.related_patterns_json as string) : [],
    createdAt: row.created_at,
  }));
}

export function saveDecision(
  db: Database,
  projectId: string,
  title: string,
  status: string,
  context: string,
  decision: string,
  consequences: string,
  alternatives?: string
): void {
  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(`
    INSERT INTO decisions
    (id, project_id, title, status, context, decision, consequences, alternatives, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, projectId, title, status, context, decision, consequences, alternatives ?? null, now, now);
}

export function getDecisionsFromDB(db: Database, projectId: string, status?: string): AnyRow[] {
  let sql = "SELECT * FROM decisions WHERE project_id = ?";
  const params: SQLQueryBindings[] = [projectId];

  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY created_at DESC";

  const rows = db.prepare(sql).all(...params) as AnyRow[];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    context: row.context,
    decision: row.decision,
    consequences: row.consequences,
    alternatives: row.alternatives,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
