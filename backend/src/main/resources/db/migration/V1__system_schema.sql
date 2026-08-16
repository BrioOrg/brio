-- Spring Modulith JPA event publication store (required by spring-modulith-starter-jpa)
CREATE TABLE IF NOT EXISTS event_publication (
    id               UUID        NOT NULL PRIMARY KEY,
    listener_id      VARCHAR(512) NOT NULL,
    event_type       VARCHAR(512) NOT NULL,
    serialized_event TEXT        NOT NULL,
    publication_date TIMESTAMPTZ NOT NULL,
    completion_date  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS event_publication_publication_date_idx
    ON event_publication (publication_date);
