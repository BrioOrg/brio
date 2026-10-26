-- Persistent session store (ADR 0034): Spring Session JDBC, so a backend restart or a
-- deploy no longer logs everyone out. Not the audit log — that stays identite.sessions
-- (ADR 0017 §5). Rows here are deleted on logout and by Spring Session's expiry cleanup.
--
-- Spring Session's own PostgreSQL schema (spring-session-jdbc, schema-postgresql.sql),
-- placed in the identite schema (ADR 0007). Column names are Spring Session's: it builds
-- its queries from spring.session.jdbc.table-name, nothing else may be renamed.
CREATE TABLE identite.spring_session (
    primary_id            CHAR(36)     NOT NULL,
    session_id            CHAR(36)     NOT NULL,
    creation_time         BIGINT       NOT NULL,
    last_access_time      BIGINT       NOT NULL,
    max_inactive_interval INT          NOT NULL,
    expiry_time           BIGINT       NOT NULL,
    principal_name        VARCHAR(100),           -- identite.comptes ID, as text
    CONSTRAINT spring_session_pk PRIMARY KEY (primary_id)
);

CREATE UNIQUE INDEX spring_session_ix1 ON identite.spring_session (session_id);
CREATE INDEX spring_session_ix2 ON identite.spring_session (expiry_time);
CREATE INDEX spring_session_ix3 ON identite.spring_session (principal_name);

CREATE TABLE identite.spring_session_attributes (
    session_primary_id CHAR(36)     NOT NULL,
    attribute_name     VARCHAR(200) NOT NULL,
    attribute_bytes    BYTEA        NOT NULL,
    CONSTRAINT spring_session_attributes_pk PRIMARY KEY (session_primary_id, attribute_name),
    CONSTRAINT spring_session_attributes_fk FOREIGN KEY (session_primary_id)
        REFERENCES identite.spring_session (primary_id) ON DELETE CASCADE
);
