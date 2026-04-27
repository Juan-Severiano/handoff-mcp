-- src/db/schema.sql
-- ProjectContext MCP Database Schema

-- PROJECTS TABLE
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner);

-- SNAPSHOTS TABLE (Context saved by LLMs)
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

-- CODE PATTERNS TABLE
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

-- ARCHITECTURAL DECISIONS TABLE
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
CREATE INDEX IF NOT EXISTS idx_decisions_created ON decisions(created_at DESC);

-- PROJECT METADATA TABLE (Architecture, Stack, etc)
CREATE TABLE IF NOT EXISTS project_metadata (
  project_id TEXT PRIMARY KEY,
  architecture_json TEXT,
  stack_json TEXT,
  env_template_json TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- SEARCH CACHE (Optional: for faster full-text search)
CREATE TABLE IF NOT EXISTS search_index (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  content_type TEXT NOT NULL, -- 'pattern', 'decision', 'snippet'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  reference_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_search_project ON search_index(project_id);
CREATE INDEX IF NOT EXISTS idx_search_type ON search_index(project_id, content_type);

-- VERSION INFO
PRAGMA user_version = 1;
