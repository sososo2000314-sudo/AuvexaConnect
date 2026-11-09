CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL UNIQUE,
 display_name TEXT NOT NULL,
 handle TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 bio TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS follows (
 follower_id TEXT NOT NULL,
 followed_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(follower_id, followed_id),
 CHECK(follower_id <> followed_id),
 FOREIGN KEY(follower_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(followed_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS posts (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('text','short','video')),
 body TEXT NOT NULL DEFAULT '',
 title TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS likes (
 user_id TEXT NOT NULL,
 post_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(user_id, post_id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS comments (
 id TEXT PRIMARY KEY,
 post_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 body TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS boards (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 created_by TEXT NOT NULL,
 approved INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL,
 FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS board_posts (
 id TEXT PRIMARY KEY,
 board_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 body TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 FOREIGN KEY(board_id) REFERENCES boards(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS maintenance (
 id INTEGER PRIMARY KEY CHECK(id=1),
 enabled INTEGER NOT NULL DEFAULT 0,
 message TEXT NOT NULL DEFAULT '',
 start_at TEXT NOT NULL DEFAULT '',
 end_at TEXT NOT NULL DEFAULT '',
 version TEXT NOT NULL DEFAULT '1.0.0',
 updated_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO maintenance(id,enabled,message,start_at,end_at,version,updated_at)
VALUES(1,0,'','', '', '1.0.0',unixepoch());
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id,created_at);
CREATE INDEX IF NOT EXISTS idx_board_posts_board ON board_posts(board_id,created_at DESC);
