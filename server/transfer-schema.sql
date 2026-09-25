-- v9: pupil transfer requests reserve no seats and grant no access before approval.
CREATE TABLE IF NOT EXISTS student_transfers (
    id VARCHAR(32) PRIMARY KEY,
    source_class_id VARCHAR(32) NOT NULL,
    target_class_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    requested_by VARCHAR(32) NOT NULL,
    mode VARCHAR(16) NOT NULL,
    expires_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL,
    UNIQUE (source_class_id,target_class_id,user_id),
    FOREIGN KEY (source_class_id) REFERENCES teacher_classes(class_id) ON DELETE CASCADE,
    FOREIGN KEY (target_class_id) REFERENCES teacher_classes(class_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by) REFERENCES teachers(user_id) ON DELETE CASCADE
);
