package fr.brio.contenu.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

/** Composite key of {@link CoursVersion}: {@code (cours_id, version)}. */
@Embeddable
public class CoursVersionId implements Serializable {

    @Column(name = "cours_id", nullable = false)
    private UUID coursId;

    @Column(nullable = false)
    private int version;

    protected CoursVersionId() {}

    public CoursVersionId(UUID coursId, int version) {
        this.coursId = coursId;
        this.version = version;
    }

    public UUID getCoursId() { return coursId; }
    public int getVersion() { return version; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof CoursVersionId other)) return false;
        return version == other.version && Objects.equals(coursId, other.coursId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(coursId, version);
    }
}
