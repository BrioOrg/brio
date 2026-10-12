package fr.brio.social.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Signalement d'un message de salon par un membre de la classe (F6b, ADR 0033). */
@Entity
@Table(name = "salon_signalements", schema = "social")
public class SalonSignalement {

    public static final String STATUT_OUVERT = "ouvert";
    public static final String STATUT_TRAITE = "traite";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "message_id", nullable = false)
    private UUID messageId;

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

    protected SalonSignalement() {}

    public SalonSignalement(UUID messageId, UUID signalePar, String motif) {
        this.messageId = messageId;
        this.signalePar = signalePar;
        this.motif = motif;
    }

    public void traiter(UUID parModerateur, Instant quand) {
        this.statut = STATUT_TRAITE;
        this.traitePar = parModerateur;
        this.traiteAt = quand;
    }

    public UUID getId() {
        return id;
    }

    public UUID getMessageId() {
        return messageId;
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
