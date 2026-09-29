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

    // Correction d'une copie déposée par l'enseignant (F5, ADR 0028) — jamais de note IA.
    @Column private java.math.BigDecimal note;

    @Column private String appreciation;

    @Column(name = "corrige_par")
    private UUID corrigePar;

    @Column(name = "corrige_at")
    private Instant corrigeAt;

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

    /** Correction manuelle par l'enseignant d'une copie déposée (F5, ADR 0028). */
    public void corriger(java.math.BigDecimal note, String appreciation, UUID corrigePar) {
        this.note = note;
        this.appreciation = appreciation;
        this.corrigePar = corrigePar;
        this.corrigeAt = Instant.now();
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

    public java.math.BigDecimal getNote() {
        return note;
    }

    public String getAppreciation() {
        return appreciation;
    }

    public UUID getCorrigePar() {
        return corrigePar;
    }

    public Instant getCorrigeAt() {
        return corrigeAt;
    }
}
