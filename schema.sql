-- AuvexaConnect お試し版専用テーブル
-- 本体の users / posts 等には触れません。必ず専用D1データベースで実行してください。
CREATE TABLE IF NOT EXISTS beta_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS beta_profiles (
  user_id TEXT PRIMARY KEY REFERENCES beta_users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  user_tag TEXT UNIQUE,
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  header_url TEXT NOT NULL DEFAULT '',
  website_url TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  birthday TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS beta_videos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES beta_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  object_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS beta_videos_created_idx ON beta_videos(created_at);

CREATE TABLE IF NOT EXISTS beta_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES beta_users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES beta_users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS beta_messages_recipient_idx ON beta_messages(recipient_id,created_at);
