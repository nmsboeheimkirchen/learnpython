-- Additive migration v3: existing accounts and learning states are untouched.
CREATE TABLE IF NOT EXISTS class_registration (
    class_id VARCHAR(32) PRIMARY KEY,
    capacity INTEGER NOT NULL DEFAULT 32,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS class_invitations (
    code_hash VARCHAR(64) PRIMARY KEY,
    class_id VARCHAR(32) NOT NULL,
    expires_at BIGINT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (class_id) REFERENCES class_registration(class_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS pending_registrations (
    id VARCHAR(32) PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    class_id VARCHAR(32) NOT NULL,
    invitation_hash VARCHAR(64) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    token_expires_at BIGINT NOT NULL DEFAULT 0,
    expires_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL,
    FOREIGN KEY (class_id) REFERENCES class_registration(class_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS mail_jobs (
    id VARCHAR(32) PRIMARY KEY,
    registration_id VARCHAR(32) NOT NULL UNIQUE,
    token VARCHAR(64) NOT NULL,
    state VARCHAR(16) NOT NULL DEFAULT 'queued',
    available_at BIGINT NOT NULL,
    lease_until BIGINT NOT NULL DEFAULT 0,
    lease_id VARCHAR(32) NOT NULL DEFAULT '',
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    FOREIGN KEY (registration_id) REFERENCES pending_registrations(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS mail_dispatch_lock (
    id INTEGER PRIMARY KEY,
    touched_at BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS mail_attempts (
    id VARCHAR(32) PRIMARY KEY,
    attempted_at BIGINT NOT NULL
);
