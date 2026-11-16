-- AuvexaConnect Part 1: additive schema only.
-- No DROP, ALTER, or destructive migration statements.
CREATE TABLE IF NOT EXISTS ac_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'ja',
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
  suspension_reason TEXT,
  suspended_until TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ac_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES ac_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ac_sessions_user_idx ON ac_sessions(user_id);
CREATE TABLE IF NOT EXISTS ac_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES ac_users(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  media_type TEXT NOT NULL DEFAULT 'image',
  visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','friends')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ac_posts_created_idx ON ac_posts(created_at DESC);
CREATE TABLE IF NOT EXISTS ac_follows (
  follower_id TEXT NOT NULL REFERENCES ac_users(id) ON DELETE CASCADE,
  followed_id TEXT NOT NULL REFERENCES ac_users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(follower_id, followed_id),
  CHECK(follower_id <> followed_id)
);
CREATE TABLE IF NOT EXISTS ac_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES ac_users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ac_notifications_user_idx ON ac_notifications(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS ac_app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ac_audit_log (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  target_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ac_external_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES ac_users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, external_user_id),
  UNIQUE(user_id, provider)
);
INSERT OR IGNORE INTO ac_app_settings(setting_key, setting_value) VALUES
 ('maintenance_enabled','false'),
 ('maintenance_message','ただいまメンテナンス中です。ご不便をおかけします。'),
 ('default_language','ja'),
 ('connect_plus_enabled','true');
