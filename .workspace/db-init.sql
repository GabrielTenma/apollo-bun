-- Main User (identity)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- null for login via Telegram/Google
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    roles JSONB DEFAULT '["user"]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Multi-provider auth (Telegram, Google, etc)
CREATE TABLE user_auth_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'telegram', 'google', 'email'
    provider_user_id VARCHAR(255) NOT NULL, -- telegram_id or google_sub
    provider_data JSONB, -- additional metadata (avatar, username)
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(provider, provider_user_id)
);

-- Session management (JWT refresh token or session cookie)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    user_agent TEXT,
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- TELEGRAM

-- Connected bot into system (can more than 1 bot)
CREATE TABLE telegram_bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_token_hash VARCHAR(255) NOT NULL, -- stored hash, main token to vault
    bot_username VARCHAR(100) UNIQUE,
    webhook_secret UUID DEFAULT gen_random_uuid(),
    is_active BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}' -- allowed updates, max connections, etc
);

-- Telegram chat/group/user interacting with the bot
CREATE TABLE telegram_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES telegram_bots(id),
    telegram_chat_id BIGINT NOT NULL, -- chat_id from telegram
    chat_type VARCHAR(20), -- 'private', 'group', 'supergroup', 'channel'
    title VARCHAR(255),
    username VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    linked_user_id UUID REFERENCES users(id), -- if the chat is linked to an internal user account
    settings JSONB DEFAULT '{}', -- per-chat preferences
    UNIQUE(bot_id, telegram_chat_id)
);

-- Incoming messages/updates from webhook (for audit & async processing)
CREATE TABLE telegram_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES telegram_bots(id),
    update_id BIGINT NOT NULL,
    telegram_chat_id BIGINT,
    message_date TIMESTAMPTZ,
    raw_update JSONB NOT NULL, -- full update from Telegram
    processed_at TIMESTAMPTZ,
    processed_by VARCHAR(100), -- handler/scenario name
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(bot_id, update_id)
);

-- SCRAPING RESULT

-- Scraping source (website, API, RSS, S3, etc.)
CREATE TABLE scraping_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL, -- 'webpage', 'api_json', 'rss', 's3_csv'
    connection_config JSONB NOT NULL, -- { url, headers, pagination, auth }
    schedule_cron VARCHAR(100), -- if scheduled
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Scrape result (one source can produce many records)
CREATE TABLE scraped_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES scraping_sources(id) ON DELETE CASCADE,
    captured_at TIMESTAMPTZ DEFAULT now(),
    raw_content TEXT, -- HTML / JSON / CSV as string
    parsed_data JSONB, -- structured parsed result (already normalized)
    data_hash VARCHAR(64) GENERATED ALWAYS AS (encode(sha256(convert_to(raw_content, 'UTF8')), 'hex')) STORED, -- for deduplication
    status VARCHAR(20) DEFAULT 'new', -- 'new', 'processed', 'failed'
    processing_log TEXT,
    UNIQUE(source_id, data_hash) -- optional: avoid perfect duplicates
);

-- Index for fast JSONB search
CREATE INDEX idx_scraped_parsed ON scraped_data USING GIN (parsed_data);

-- CONFIGURATION BY FEATURE

-- Feature flag / system config
CREATE TABLE feature_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key VARCHAR(255) NOT NULL, -- e.g., "scraping.max_concurrent", "telegram.greeting_message"
    value_type VARCHAR(20) DEFAULT 'string', -- 'string', 'integer', 'boolean', 'json', 'duration'
    value_string TEXT,
    value_integer BIGINT,
    value_boolean BOOLEAN,
    value_json JSONB,
    description TEXT,
    -- scope: global, per-user, per-telegram-chat, per-scraping-source
    scope_type VARCHAR(50), -- 'global', 'user', 'telegram_chat', 'scraping_source'
    scope_id UUID, -- ID from related table (users.id, telegram_chats.id, etc.)
    priority INT DEFAULT 0, -- larger value means higher override priority
    is_enabled BOOLEAN DEFAULT true,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Use partial unique index so only one default per (feature_key, scope_type, scope_id)
CREATE UNIQUE INDEX idx_feature_configs_unique 
ON feature_configs (feature_key, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'))
WHERE is_enabled = true AND priority = 0;

-- Helper view to obtain value with fallback
-- (can be implemented in the application or with a query window function)

-- Additional indexes for scraped_data table
CREATE INDEX idx_scraped_source ON scraped_data (source_id);
CREATE INDEX idx_scraped_captured ON scraped_data (captured_at);
CREATE INDEX idx_scraped_status ON scraped_data (status);

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

-- Example row user (password: password123)
INSERT INTO public.users
(id, email, password_hash, full_name, is_active, created_at, updated_at, roles)
VALUES('a84aefe6-4d53-4f1e-bbb9-070c29896b5e'::uuid, 'user@example.com', '$2b$10$SY6MTWGYVATZgydMRc0tteJm02cpb1Z8WnXERdwctIHk7qW0nQvCq', NULL, true, '2026-05-15 06:01:45.467', '2026-05-15 06:01:45.467', '["user"]'::jsonb);