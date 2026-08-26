import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

export const DATA_DIR = path.join(process.cwd(), 'data')
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')

mkdirSync(UPLOAD_DIR, { recursive: true })

// Next dev reloads modules; keep one connection on globalThis so we don't leak handles.
const g = globalThis as { __db?: Database.Database }

function open() {
  const db = new Database(path.join(DATA_DIR, 'photobooth.db'))
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      frame_file    TEXT,
      frame_w       INTEGER,
      frame_h       INTEGER,
      shot_count    INTEGER NOT NULL DEFAULT 3,
      slots         TEXT NOT NULL DEFAULT '[]',
      smtp_host     TEXT NOT NULL DEFAULT '',
      smtp_port     INTEGER NOT NULL DEFAULT 587,
      smtp_user     TEXT NOT NULL DEFAULT '',
      smtp_pass_enc TEXT NOT NULL DEFAULT '',
      from_name     TEXT NOT NULL DEFAULT '',
      from_email    TEXT NOT NULL DEFAULT '',
      created_at    INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS send_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id TEXT NOT NULL,
      to_email     TEXT NOT NULL,
      ok           INTEGER NOT NULL,
      error        TEXT,
      created_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_send_log_ws ON send_log (workspace_id, created_at DESC);
  `)
  return db
}

export const db = (g.__db ??= open())

/** One photo slot, stored as fractions of the frame's own width/height. */
export type { Slot } from './validate'

export type WorkspaceRow = {
  id: string
  name: string
  frame_file: string | null
  frame_w: number | null
  frame_h: number | null
  shot_count: number
  slots: string
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_pass_enc: string
  from_name: string
  from_email: string
  created_at: number
}

export function getWorkspace(id: string) {
  return db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as
    | WorkspaceRow
    | undefined
}

export function listWorkspaces() {
  return db
    .prepare('SELECT * FROM workspaces ORDER BY created_at DESC')
    .all() as WorkspaceRow[]
}

export function logSend(
  workspaceId: string,
  toEmail: string,
  ok: boolean,
  error?: string
) {
  db.prepare(
    'INSERT INTO send_log (workspace_id, to_email, ok, error, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(workspaceId, toEmail, ok ? 1 : 0, error ?? null, Date.now())
}

export type SendLogRow = {
  id: number
  workspace_id: string
  to_email: string
  ok: number
  error: string | null
  created_at: number
}

export function recentSends(workspaceId: string, limit = 20) {
  return db
    .prepare(
      'SELECT * FROM send_log WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?'
    )
    .all(workspaceId, limit) as SendLogRow[]
}
