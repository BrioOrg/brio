package fr.brio.contenu.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Une session d'examen sur une annale (F7, ADR 0027) : initiée par l'élève, chronométrée. Tant
 * qu'elle est {@code en_cours} et non expirée, le tuteur est coupé (garde côté serveur) et la
 * correction reste cachée. Réutilise le mécanisme du mode contrôle (ADR 0025).
 */
@Entity
@Table(name = "examen_sessions", schema = "contenu")
public class ExamenSession {

  public static final String EN_COURS = "en_cours";
  public static final String TERMINE = "termine";

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  @Column(nullable = false)
  private UUID id;

  @Column(name = "eleve_id", nullable = false)
  private UUID eleveId;

  @Column(name = "annale_chapitre_id", nullable = false)
  private String annaleChapitreId;

  @Column(name = "started_at", nullable = false)
  private Instant startedAt;

  @Column(name = "ends_at", nullable = false)
  private Instant endsAt;

  @Column(nullable = false)
  private String statut;

  @Column(name = "termine_at")
  private Instant termineAt;

  protected ExamenSession() {}

  public ExamenSession(UUID eleveId, String annaleChapitreId, Instant startedAt, Instant endsAt) {
    this.eleveId = eleveId;
    this.annaleChapitreId = annaleChapitreId;
    this.startedAt = startedAt;
    this.endsAt = endsAt;
    this.statut = EN_COURS;
  }

  /** Clôt la session (rendu explicite de l'élève). */
  public void terminer(Instant when) {
    this.statut = TERMINE;
    this.termineAt = when;
  }

  public UUID getId() {
    return id;
  }

  public UUID getEleveId() {
    return eleveId;
  }

  public String getAnnaleChapitreId() {
    return annaleChapitreId;
  }

  public Instant getStartedAt() {
    return startedAt;
  }

  public Instant getEndsAt() {
    return endsAt;
  }

  public String getStatut() {
    return statut;
  }

  public Instant getTermineAt() {
    return termineAt;
  }
}
