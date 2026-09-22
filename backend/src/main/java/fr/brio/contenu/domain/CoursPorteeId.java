package fr.brio.contenu.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

/** Composite key of {@link CoursPortee}: {@code (cours_id, classe_id)}. */
@Embeddable
public class CoursPorteeId implements Serializable {

    @Column(name = "cours_id", nullable = false)
    private UUID coursId;

    @Column(name = "classe_id", nullable = false)
    private UUID classeId;

    protected CoursPorteeId() {}

    public CoursPorteeId(UUID coursId, UUID classeId) {
        this.coursId = coursId;
        this.classeId = classeId;
    }

    public UUID getCoursId() { return coursId; }
    public UUID getClasseId() { return classeId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof CoursPorteeId other)) return false;
        return Objects.equals(coursId, other.coursId) && Objects.equals(classeId, other.classeId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(coursId, classeId);
    }
}
