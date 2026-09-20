package fr.brio.progression.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * One exercise solved by one student, recorded from {@code SoumissionEnregistree}.
 * This is the source of truth for the "≥ 80 % des exercices" completion gate —
 * kept separate from {@link EvenementXp} because a correct submission past the
 * daily XP cap leaves no XP row yet must still count toward completion (ADR 0022).
 * The unique constraint (eleve_id, chapitre_id, exercice_id) makes it a distinct set.
 */
@Entity
@Table(name = "exercices_reussis", schema = "progression")
public class ExerciceReussi {

    @Id
    private UUID id;

    @Column(name = "eleve_id", nullable = false)
    private UUID eleveId;

    @Column(name = "chapitre_id", nullable = false)
    private String chapitreId;

    @Column(name = "exercice_id", nullable = false)
    private UUID exerciceId;

    @Column(name = "reussi_at", nullable = false)
    private Instant reussiAt;

    protected ExerciceReussi() {}

    public ExerciceReussi(UUID eleveId, String chapitreId, UUID exerciceId, Instant reussiAt) {
        this.id = UUID.randomUUID();
        this.eleveId = eleveId;
        this.chapitreId = chapitreId;
        this.exerciceId = exerciceId;
        this.reussiAt = reussiAt;
    }

    public UUID getId() { return id; }
    public UUID getEleveId() { return eleveId; }
    public String getChapitreId() { return chapitreId; }
    public UUID getExerciceId() { return exerciceId; }
}
