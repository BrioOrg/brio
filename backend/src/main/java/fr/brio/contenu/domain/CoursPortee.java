package fr.brio.contenu.domain;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;

/**
 * Which class a course is visible to (ADR 0019 §3). A course published to its
 * {@code cours_portees} becomes readable by those classes. Referenced by ID, no FK to
 * identite (ADR 0007, V26 header): an orphan scope after a class deletion is cleaned
 * applicatively.
 */
@Entity
@Table(name = "cours_portees", schema = "contenu")
public class CoursPortee {

    @EmbeddedId
    private CoursPorteeId id;

    protected CoursPortee() {}

    public CoursPortee(UUID coursId, UUID classeId) {
        this.id = new CoursPorteeId(coursId, classeId);
    }

    public UUID getCoursId() { return id.getCoursId(); }
    public UUID getClasseId() { return id.getClasseId(); }
}
