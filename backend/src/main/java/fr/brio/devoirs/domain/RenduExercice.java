package fr.brio.devoirs.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * La dernière soumission connue d'un élève pour un exercice d'un devoir — la projection derrière le
 * rendu dérivé. Idempotent par (rendu, exercice) : une nouvelle soumission met à jour la ligne.
 */
@Entity
@Table(name = "rendu_exercices", schema = "devoirs")
public class RenduExercice {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "rendu_id", nullable = false)
    private UUID renduId;

    @Column(name = "exercice_id", nullable = false)
    private UUID exerciceId;

    @Column(nullable = false)
    private boolean correct;

    @Column(nullable = false)
    private double score;

    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt;

    @ElementCollection
    @CollectionTable(
            name = "rendu_exercice_competences",
            schema = "devoirs",
            joinColumns = @JoinColumn(name = "rendu_exercice_id"))
    @Column(name = "code", nullable = false)
    private Set<String> competencies = new HashSet<>();

    protected RenduExercice() {}

    public RenduExercice(UUID renduId, UUID exerciceId) {
        this.renduId = renduId;
        this.exerciceId = exerciceId;
    }

    /** Met à jour la dernière soumission connue pour cet exercice (idempotent). */
    public void maj(boolean correct, double score, Instant submittedAt, Collection<String> competencies) {
        this.correct = correct;
        this.score = score;
        this.submittedAt = submittedAt;
        this.competencies = new HashSet<>(competencies);
    }

    public UUID getId() {
        return id;
    }

    public UUID getRenduId() {
        return renduId;
    }

    public UUID getExerciceId() {
        return exerciceId;
    }

    public boolean isCorrect() {
        return correct;
    }

    public double getScore() {
        return score;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public Set<String> getCompetencies() {
        return Set.copyOf(competencies);
    }
}
