package fr.brio.identite.infrastructure;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * One-minute window attempt counter for a truncated client IP (ADR 0017 §7). Written through a
 * native upsert in {@link DebitConnexionRepository}; this mapping exists for schema validation.
 */
@Entity
@Table(schema = "identite", name = "debit_connexion")
class DebitConnexion {

    @Id
    @Column(name = "ip_tronquee")
    private String ipTronquee;

    @Column(name = "fenetre_debut", nullable = false)
    private Instant fenetreDebut;

    @Column(nullable = false)
    private int nb;

    protected DebitConnexion() {}
}
