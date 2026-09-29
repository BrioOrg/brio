package fr.brio.devoirs.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Le rendu d'un élève pour un devoir. Statut et score sont DÉRIVÉS de ses soumissions d'exercices
 * (ADR 0020 §3) — voir {@link DerivationRendu} et {@link RenduExercice}. Il n'y a pas de note saisie
 * à la main par l'enseignant en v1.
 */
@Entity
@Table(name = "rendus", schema = "devoirs")
public class Rendu {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "devoir_id", nullable = false)
    private UUID devoirId;

    @Column(name = "eleve_id", nullable = false)
    private UUID eleveId;

    @Column(nullable = false)
    private String statut;

    @Column private Double score;

    @Column(name = "rendu_at")
    private Instant renduAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Rendu() {}

    public Rendu(UUID devoirId, UUID eleveId) {
        this.devoirId = devoirId;
        this.eleveId = eleveId;
        this.statut = DerivationRendu.NON_COMMENCE;
        this.createdAt = Instant.now();
    }

    /** Applique le résultat dérivé des soumissions (voir {@link DerivationRendu}). */
    public void appliquer(String statut, Double score, Instant renduAt) {
        this.statut = statut;
        this.score = score;
        this.renduAt = renduAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getDevoirId() {
        return devoirId;
    }

    public UUID getEleveId() {
        return eleveId;
    }

    public String getStatut() {
        return statut;
    }

    public Double getScore() {
        return score;
    }

    public Instant getRenduAt() {
        return renduAt;
    }
}
