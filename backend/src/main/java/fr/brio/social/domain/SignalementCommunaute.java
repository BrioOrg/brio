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
 * Signalement d'une question ou d'une réponse de la Communauté par un membre (suivi #338).
 * Un compte ne signale qu'une fois une cible donnée (contrainte d'unicité V44).
 */
@Entity
@Table(name = "communaute_signalements", schema = "social")
public class SignalementCommunaute {

    public static final String STATUT_OUVERT = "ouvert";
    public static final String STATUT_TRAITE = "traite";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "cible_type", nullable = false)
    private String cibleType;

    @Column(name = "cible_id", nullable = false)
    private UUID cibleId;

    @Column(name = "signale_par", nullable = false)
    private UUID signalePar;

    @Column(name = "motif")
    private String motif;

    @Column(name = "statut", nullable = false)
    private String statut = STATUT_OUVERT;

    @Column(name = "traite_par")
    private UUID traitePar;

    @Column(name = "traite_at")
    private Instant traiteAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected SignalementCommunaute() {}

    public SignalementCommunaute(CibleCommunaute cible, UUID cibleId, UUID signalePar, String motif) {
        this.cibleType = cible.code();
        this.cibleId = cibleId;
        this.signalePar = signalePar;
        this.motif = motif;
    }

    /** Clôt le signalement — un admin l'a tranché. */
    public void traiter(UUID parAdmin, Instant quand) {
        this.statut = STATUT_TRAITE;
        this.traitePar = parAdmin;
        this.traiteAt = quand;
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

    public UUID getSignalePar() {
        return signalePar;
    }

    public String getMotif() {
        return motif;
    }

    public String getStatut() {
        return statut;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
