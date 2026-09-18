-- Portable subset for MySQL/MariaDB (InnoDB) and the local SQLite test database.
-- On MySQL the migration CLI requires InnoDB as the default storage engine.
CREATE TABLE IF NOT EXISTS classes (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(32) PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    class_id VARCHAR(32) NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at BIGINT NOT NULL,
    FOREIGN KEY (class_id) REFERENCES classes(id)
);
CREATE TABLE IF NOT EXISTS learning_states (
    user_id VARCHAR(32) PRIMARY KEY,
    revision INTEGER NOT NULL DEFAULT 0,
    document MEDIUMTEXT NOT NULL,
    updated_at BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS write_receipts (
    user_id VARCHAR(32) NOT NULL,
    operation_id VARCHAR(64) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    revision INTEGER NOT NULL,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, operation_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS login_limits (
    bucket_key VARCHAR(64) PRIMARY KEY,
    hits INTEGER NOT NULL,
    expires_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at BIGINT NOT NULL
);
