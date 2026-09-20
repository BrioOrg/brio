package fr.brio.progression.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * One submission's outcome for one competence, recorded from {@code SoumissionEnregistree}.
 * This is progression's own recomputable source for mastery (ADR 0022 §6): the module
 * cannot read {@code exercices.soumissions} without the outbound call §3 forbids, so it
 * keeps its own copy — exactly as #94 introduced {@code exercices_reussis} for completion.
 * The unique constraint (soumission_id, competence_code) makes ingestion idempotent so a
 * Modulith redelivery after a crash does not skew the sample.
 */
@Entity
@Table(name = "soumissions_competences", schema = "progression")
public class SoumissionCompetence {

    @Id
    private UUID id;

    @Column(name = "eleve_id", nullable = false)
    private UUID eleveId;

    @Column(name = "soumission_id", nullable = false)
    private UUID soumissionId;

    @Column(name = "competence_code", nullable = false)
    private String competenceCode;

    @Column(nullable = false)
    private boolean correct;

    @Column(nullable = false)
    private double score;

    @Column(name = "premiere_tentative", nullable = false)
    private boolean premiereTentative;

    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt;

    protected SoumissionCompetence() {}

    public SoumissionCompetence(
            UUID eleveId,
            UUID soumissionId,
            String competenceCode,
            boolean correct,
            double score,
            boolean premiereTentative,
            Instant submittedAt) {
        this.id = UUID.randomUUID();
        this.eleveId = eleveId;
        this.soumissionId = soumissionId;
        this.competenceCode = competenceCode;
        this.correct = correct;
        this.score = score;
        this.premiereTentative = premiereTentative;
        this.submittedAt = submittedAt;
    }

    public UUID getId() { return id; }
    public UUID getEleveId() { return eleveId; }
    public UUID getSoumissionId() { return soumissionId; }
    public String getCompetenceCode() { return competenceCode; }
    public boolean isCorrect() { return correct; }
    public double getScore() { return score; }
    public boolean isPremiereTentative() { return premiereTentative; }
    public Instant getSubmittedAt() { return submittedAt; }
}
