-- Additive v5. The one-time user reset is deliberately NOT a migration.
CREATE TABLE IF NOT EXISTS teachers (
    user_id VARCHAR(32) PRIMARY KEY,
    class_limit INTEGER NOT NULL DEFAULT 10,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS teacher_classes (
    class_id VARCHAR(32) PRIMARY KEY,
    teacher_id VARCHAR(32) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    UNIQUE (teacher_id, display_name),
    FOREIGN KEY (class_id) REFERENCES class_registration(class_id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(user_id)
);
CREATE TABLE IF NOT EXISTS invitation_secrets (
    code_hash VARCHAR(64) PRIMARY KEY,
    encrypted_code VARCHAR(512) NOT NULL,
    FOREIGN KEY (code_hash) REFERENCES class_invitations(code_hash) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS teacher_audit (
    id VARCHAR(32) PRIMARY KEY,
    teacher_id VARCHAR(32) NOT NULL,
    class_id VARCHAR(32) NOT NULL,
    action VARCHAR(32) NOT NULL,
    created_at BIGINT NOT NULL
);
