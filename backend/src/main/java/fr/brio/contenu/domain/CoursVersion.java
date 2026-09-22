package fr.brio.contenu.domain;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.PostLoad;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.domain.Persistable;

/**
 * An immutable published snapshot of a course (ADR 0019 §3). Has no mutators by design:
 * once a version is published, a future devoir (F4) can reference {@code (cours_id, version)}
 * and trust the subject can never change under a student who started it — the same guarantee
 * as exercise-UUID preservation (ADR 0010). {@code content} is already stripped of correction
 * fields at publish time.
 */
@Entity
@Table(name = "cours_versions", schema = "contenu")
public class CoursVersion implements Persistable<CoursVersionId> {

    @EmbeddedId
    private CoursVersionId id;

    @Transient
    private boolean isNew = true;

    @Column(nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String content;

    @Column(name = "publie_at", nullable = false, updatable = false)
    private Instant publieAt;

    protected CoursVersion() {}

    public CoursVersion(UUID coursId, int version, String content) {
        this.id = new CoursVersionId(coursId, version);
        this.content = content;
        this.publieAt = Instant.now();
    }

    @PostLoad
    void markNotNew() {
        this.isNew = false;
    }

    @Override public boolean isNew() { return isNew; }
    @Override public CoursVersionId getId() { return id; }
    public UUID getCoursId() { return id.getCoursId(); }
    public int getVersion() { return id.getVersion(); }
    public String getContent() { return content; }
    public Instant getPublieAt() { return publieAt; }
}
