-- AuvexaConnect additive services migration. Safe to run repeatedly.
-- Does NOT drop, rename, or modify existing tables/data.
CREATE TABLE IF NOT EXISTS app_mail_addresses (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  local_part TEXT NOT NULL COLLATE NOCASE UNIQUE, address TEXT NOT NULL COLLATE NOCASE UNIQUE,
  status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS app_mail_messages (
  id TEXT PRIMARY KEY, sender_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', folder TEXT NOT NULL DEFAULT 'inbox',
  read_at TEXT, deleted_at TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_app_mail_recipient ON app_mail_messages(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_mail_sender ON app_mail_messages(sender_user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS app_phone_assignments (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  app_number TEXT NOT NULL UNIQUE, real_number TEXT UNIQUE, provider TEXT, status TEXT NOT NULL DEFAULT 'app_only',
  provision_status TEXT NOT NULL DEFAULT 'pending_provider', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS board_categories (
  board_id TEXT PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE, category TEXT NOT NULL DEFAULT 'other'
);
CREATE TABLE IF NOT EXISTS board_admin_notices (
  id TEXT PRIMARY KEY, board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  creator_id TEXT REFERENCES users(id) ON DELETE SET NULL, action TEXT NOT NULL, reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
