-- Optional sync (docs/SYNC.md). The Worker also creates these on first use.
CREATE TABLE IF NOT EXISTS sync_spaces (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, epoch INTEGER NOT NULL DEFAULT 0, bytes INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sync_ops (seq INTEGER PRIMARY KEY AUTOINCREMENT, space_id TEXT NOT NULL, op_id TEXT NOT NULL, epoch INTEGER NOT NULL, reset INTEGER NOT NULL DEFAULT 0, iv TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(space_id, op_id));
CREATE INDEX IF NOT EXISTS sync_ops_space_seq ON sync_ops(space_id, seq);
