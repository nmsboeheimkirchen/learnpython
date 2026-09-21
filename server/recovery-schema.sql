-- Additive v4: no existing user, password or learning document is rewritten.
CREATE TABLE IF NOT EXISTS auth_epochs (
    user_id VARCHAR(32) PRIMARY KEY,
    revision INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS password_resets (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL UNIQUE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    credential_hash VARCHAR(64) NOT NULL,
    token_expires_at BIGINT NOT NULL DEFAULT 0,
    expires_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS recovery_mail_jobs (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL,
    reset_id VARCHAR(32) UNIQUE,
    kind VARCHAR(16) NOT NULL,
    token VARCHAR(64) NOT NULL DEFAULT '',
    state VARCHAR(16) NOT NULL DEFAULT 'queued',
    available_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    lease_until BIGINT NOT NULL DEFAULT 0,
    lease_id VARCHAR(32) NOT NULL DEFAULT '',
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reset_id) REFERENCES password_resets(id) ON DELETE CASCADE
);
