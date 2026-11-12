package fr.brio.social.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Trace d'une décision de modération prise par {@code admin_brio} sur une cible (suivi #338).
 * Journal d'audit : une ligne par action, restauration comprise.
 */
@Entity
@Table(name = "communaute_decisions", schema = "social")
public class DecisionModeration {

    public static final String ACTION_MASQUER = "masquer";
    public static final String ACTION_SUPPRIMER = "supprimer";
    public static final String ACTION_REJETER = "rejeter";
    public static final String ACTION_RESTAURER = "restaurer";
    public static final String ACTION_REVOQUER_XP = "revoquer_xp";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "cible_type", nullable = false)
    private String cibleType;

    @Column(name = "cible_id", nullable = false)
    private UUID cibleId;

    @Column(name = "action", nullable = false)
    private String action;

    @Column(name = "motif")
    private String motif;

    @Column(name = "decidee_par", nullable = false)
    private UUID decideePar;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected DecisionModeration() {}

    public DecisionModeration(CibleCommunaute cible, UUID cibleId, String action, String motif, UUID decideePar) {
        this.cibleType = cible.code();
        this.cibleId = cibleId;
        this.action = action;
        this.motif = motif;
        this.decideePar = decideePar;
    }

    public UUID getId() {
        return id;
    }

    public CibleCommunaute getCible() {
        return CibleCommunaute.depuisCode(cibleType);
    }

    public UUID getCibleId() {
        return cibleId;
    }

    public String getAction() {
        return action;
    }

    public String getMotif() {
        return motif;
    }

    public UUID getDecideePar() {
        return decideePar;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
