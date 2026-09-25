-- v7: roles and teaching assignments are independent of student membership.
CREATE TABLE IF NOT EXISTS superadmins (
    user_id VARCHAR(32) PRIMARY KEY,
    created_at BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS class_teachers (
    class_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (class_id,user_id),
    FOREIGN KEY (class_id) REFERENCES teacher_classes(class_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES teachers(user_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS teacher_invitations (
    id VARCHAR(32) PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    class_limit INTEGER NOT NULL,
    invited_by VARCHAR(32) NOT NULL,
    expires_at BIGINT NOT NULL,
    accepted_at BIGINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    FOREIGN KEY (invited_by) REFERENCES superadmins(user_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS teacher_mail_jobs (
    id VARCHAR(32) PRIMARY KEY,
    invitation_id VARCHAR(32) NOT NULL,
    token VARCHAR(64) NOT NULL,
    state VARCHAR(16) NOT NULL DEFAULT 'queued',
    available_at BIGINT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    lease_until BIGINT NOT NULL DEFAULT 0,
    lease_id VARCHAR(32) NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL,
    FOREIGN KEY (invitation_id) REFERENCES teacher_invitations(id) ON DELETE CASCADE
);
