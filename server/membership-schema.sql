-- v6 is additive: users.class_id remains a compatible primary class for old releases.
-- Extra class memberships and email verification are independent of login eligibility.
CREATE TABLE IF NOT EXISTS class_memberships (
    user_id VARCHAR(32) NOT NULL,
    class_id VARCHAR(32) NOT NULL,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (user_id,class_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS email_confirmations (
    user_id VARCHAR(32) PRIMARY KEY,
    confirmed INTEGER NOT NULL DEFAULT 1,
    updated_at BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
