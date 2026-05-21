-- db_init.sqllite.sql — SQLite version of the database schema
-- All types adapted from the Postgres schema (.workspace/db-init.sql).
-- Run once to bootstrap a fresh local SQLite database.

PRAGMA foreign_keys = ON;

-- Main User (identity)
CREATE TABLE users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || substr(hex(randomblob(2)), 3) || '-4' || substr(hex(randomblob(2)), 3) || '-' || substr(hex(randomblob(4)), 3))),
    email TEXT(255) NOT NULL UNIQUE,
    password_hash TEXT(255),  -- null for login via Telegram/Google
    full_name TEXT(255),
    is_active INTEGER DEFAULT 1,
    roles TEXT DEFAULT '["user"]',
    created_at TEXT,
    updated_at TEXT
);

-- Multi-provider auth (Telegram, Google, etc)
CREATE TABLE user_auth_providers (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || substr(hex(randomblob(2)), 3) || '-4' || substr(hex(randomblob(2)), 3) || '-' || substr(hex(randomblob(4)), 3))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT(50) NOT NULL,  -- 'telegram', 'google', 'email'
    provider_user_id TEXT(255) NOT NULL,  -- telegram_id or google_sub
    provider_data TEXT,  -- additional metadata (avatar, username)
    created_at TEXT,
    UNIQUE(provider, provider_user_id)
);

-- Session management (JWT refresh token or session cookie)
CREATE TABLE user_sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || substr(hex(randomblob(2)), 3) || '-4' || substr(hex(randomblob(2)), 3) || '-' || substr(hex(randomblob(4)), 3))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT(255) NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT
);

-- TELEGRAM

-- Connected bot into system (can more than 1 bot)
CREATE TABLE telegram_bots (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || substr(hex(randomblob(2)), 3) || '-4' || substr(hex(randomblob(2)), 3) || '-' || substr(hex(randomblob(4)), 3))),
    bot_token_hash TEXT(255) NOT NULL,  -- stored hash; main token in vault
    bot_username TEXT(100) UNIQUE,
    webhook_secret TEXT DEFAULT (lower(hex(randomblob(4)) || '-' || substr(hex(randomblob(2)), 3) || '-4' || substr(hex(randomblob(2)), 3) || '-' || substr(hex(randomblob(4)), 3))),
    is_active INTEGER DEFAULT 1,
    config TEXT DEFAULT '{}'  -- allowed updates, max connections, etc
);

-- Telegram chat/group/user interacting with the bot
CREATE TABLE telegram_chats (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || substr(hex(randomblob(2)), 3) || '-4' || substr(hex(randomblob(2)), 3) || '-' || substr(hex(randomblob(4)), 3))),
    bot_id TEXT NOT NULL,
    telegram_chat_id INTEGER NOT NULL,  -- chat_id from Telegram
    chat_type TEXT(20),  -- 'private', 'group', 'supergroup', 'channel'
    title TEXT(255),
    username TEXT(255),
    first_name TEXT(100),
    last_name TEXT(100),
    linked_user_id TEXT,  -- if the chat is linked to an internal user account
    settings TEXT DEFAULT '{}',  -- per-chat preferences
    UNIQUE(bot_id, telegram_chat_id)
);

-- Incoming messages/updates from webhook (for audit & async processing)
CREATE TABLE telegram_updates (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || substr(hex(randomblob(2)), 3) || '-4' || substr(hex(randomblob(2)), 3) || '-' || substr(hex(randomblob(4)), 3))),
    bot_id TEXT NOT NULL,
    update_id INTEGER NOT NULL,
    telegram_chat_id INTEGER,
    message_date TEXT,
    raw_update TEXT NOT NULL,  -- full update from Telegram
    processed_at TEXT,
    processed_by TEXT(100),  -- handler/scenario name
    error TEXT,
    created_at TEXT,
    UNIQUE(bot_id, update_id)
);

-- SCRAPING RESULT

-- Scraping source (website, API, RSS, S3, etc.)
CREATE TABLE scraping_sources (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || substr(hex(randomblob(2)), 3) || '-4' || substr(hex(randomblob(2)), 3) || '-' || substr(hex(randomblob(4)), 3))),
    name TEXT(255) NOT NULL,
    source_type TEXT(50) NOT NULL,  -- 'webpage', 'api_json', 'rss', 's3_csv'
    connection_config TEXT NOT NULL,  -- { url, headers, pagination, auth }
    schedule_cron TEXT(100),  -- if scheduled
    is_active INTEGER DEFAULT 1,
    created_at TEXT
);

-- Scrape result (one source can produce many records)
CREATE TABLE scraped_data (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || substr(hex(randomblob(2)), 3) || '-4' || substr(hex(randomblob(2)), 3) || '-' || substr(hex(randomblob(4)), 3))),
    source_id TEXT NOT NULL REFERENCES scraping_sources(id) ON DELETE CASCADE,
    captured_at TEXT DEFAULT (datetime('now')),
    raw_content TEXT,  -- HTML / JSON / CSV as string
    parsed_data TEXT,  -- structured parsed result (already normalized JSON)
    data_hash TEXT(64),  -- sha256 hex for deduplication
    status TEXT(20) DEFAULT 'new',  -- 'new', 'processed', 'failed'
    processing_log TEXT,
    UNIQUE(source_id, data_hash)  -- avoid perfect duplicates
);

-- Indexes for scraped_data
CREATE INDEX idx_scraped_data_source ON scraped_data (source_id);
CREATE INDEX idx_scraped_data_captured ON scraped_data (captured_at);
CREATE INDEX idx_scraped_data_status ON scraped_data (status);

-- CONFIGURATION BY FEATURE

-- Feature flag / system config
CREATE TABLE feature_configs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || substr(hex(randomblob(2)), 3) || '-4' || substr(hex(randomblob(2)), 3) || '-' || substr(hex(randomblob(4)), 3))),
    feature_key TEXT(255) NOT NULL,  -- e.g., "scraping.max_concurrent", "telegram.greeting_message"
    value_type TEXT(20) DEFAULT 'string',  -- 'string', 'integer', 'boolean', 'json', 'duration'
    value_string TEXT,
    value_integer INTEGER,
    value_boolean INTEGER,
    value_json TEXT,
    description TEXT,
    -- scope: global, per-user, per-telegram-chat, per-scraping-source
    scope_type TEXT(50),  -- 'global', 'user', 'telegram_chat', 'scraping_source'
    scope_id TEXT,  -- ID from related table (users.id, telegram_chats.id, etc.)
    priority INTEGER DEFAULT 0,  -- larger value means higher override priority
    is_enabled INTEGER DEFAULT 1,
    updated_by TEXT,  -- references users(id), FK not enforced to avoid drop-order issues
    created_at TEXT,
    updated_at TEXT,
    UNIQUE(feature_key, scope_type, scope_id)
);

-- Indexes for users table
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_created_at ON users (created_at);
CREATE INDEX idx_users_active ON users (is_active);

-- Indexes for user_auth_providers table
CREATE INDEX idx_user_auth_user ON user_auth_providers (user_id);
CREATE INDEX idx_user_auth_provider ON user_auth_providers (provider);

-- Indexes for user_sessions table
CREATE INDEX idx_user_sessions_user ON user_sessions (user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions (expires_at);

-- Indexes for telegram_bots table
CREATE INDEX idx_telegram_bots_username ON telegram_bots (bot_username);

-- Indexes for telegram_chats table
CREATE INDEX idx_telegram_chats_bot ON telegram_chats (bot_id);
CREATE INDEX idx_telegram_chats_linked_user ON telegram_chats (linked_user_id);

-- Indexes for telegram_updates table
CREATE INDEX idx_telegram_updates_bot ON telegram_updates (bot_id);
CREATE INDEX idx_telegram_updates_chat ON telegram_updates (telegram_chat_id);
CREATE INDEX idx_telegram_updates_date ON telegram_updates (message_date);

-- Indexes for scraping_sources table
CREATE INDEX idx_scraping_sources_type ON scraping_sources (source_type);
CREATE INDEX idx_scraping_sources_active ON scraping_sources (is_active);
CREATE INDEX idx_scraping_sources_created ON scraping_sources (created_at);
