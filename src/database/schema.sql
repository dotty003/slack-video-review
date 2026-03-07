-- Videos table: stores detected videos
CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL,
    message_ts TEXT NOT NULL,
    thread_ts TEXT,
    uploader_id TEXT NOT NULL,
    video_url TEXT,
    video_name TEXT,
    video_type TEXT,
    team_id TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel_id, message_ts)
);

-- Migration: add team_id to existing videos table if column doesn't exist
-- (PostgreSQL-safe: uses DO block or ignored via application code)

-- Comments table: stores timestamp comments
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    timestamp_seconds INTEGER NOT NULL,
    comment_text TEXT NOT NULL,
    attachment_url TEXT,
    attachment_filename TEXT,
    slack_message_ts TEXT,
    slack_channel_id TEXT,
    resolved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

-- Index for faster comment lookups
CREATE INDEX IF NOT EXISTS idx_comments_video_id ON comments(video_id);
CREATE INDEX IF NOT EXISTS idx_videos_message ON videos(channel_id, message_ts);

-- Installations table: stores per-workspace OAuth tokens
CREATE TABLE IF NOT EXISTS installations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL UNIQUE,
    team_name TEXT,
    bot_token TEXT NOT NULL,
    bot_id TEXT,
    bot_user_id TEXT,
    app_id TEXT,
    enterprise_id TEXT,
    enterprise_name TEXT,
    is_enterprise_install INTEGER DEFAULT 0,
    installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_installations_team ON installations(team_id);
CREATE INDEX IF NOT EXISTS idx_installations_enterprise ON installations(enterprise_id);

