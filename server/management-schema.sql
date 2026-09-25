-- v8: the school namespace is immutable even when ownership changes.
CREATE TABLE IF NOT EXISTS class_namespaces (
    class_id VARCHAR(32) PRIMARY KEY,
    school_domain VARCHAR(254) NOT NULL,
    name_key VARCHAR(64) NOT NULL,
    UNIQUE (school_domain, name_key),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);
