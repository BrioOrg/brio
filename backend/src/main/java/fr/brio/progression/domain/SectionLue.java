package fr.brio.progression.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * One section read by one student. The unique constraint
 * (eleve_id, chapitre_id, section_id) — declared in V20 — makes the "section lue"
 * signal idempotent, so re-reading a section neither double-counts completion nor
 * re-awards XP.
 */
@Entity
@Table(name = "sections_lues", schema = "progression")
public class SectionLue {

    @Id
    private UUID id;

    @Column(name = "eleve_id", nullable = false)
    private UUID eleveId;

    @Column(name = "chapitre_id", nullable = false)
    private String chapitreId;

    @Column(name = "section_id", nullable = false)
    private String sectionId;

    @Column(name = "lu_at", nullable = false)
    private Instant luAt;

    protected SectionLue() {}

    public SectionLue(UUID eleveId, String chapitreId, String sectionId, Instant luAt) {
        this.id = UUID.randomUUID();
        this.eleveId = eleveId;
        this.chapitreId = chapitreId;
        this.sectionId = sectionId;
        this.luAt = luAt;
    }

    public UUID getId() { return id; }
    public UUID getEleveId() { return eleveId; }
    public String getChapitreId() { return chapitreId; }
    public String getSectionId() { return sectionId; }
}
