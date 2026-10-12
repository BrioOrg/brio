package fr.brio.social.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Un message dans un salon de classe (F6b, ADR 0033). */
@Entity
@Table(name = "salon_messages", schema = "social")
public class SalonMessage {

    public static final String STATUT_PUBLIE = "publie";
    public static final String STATUT_MASQUE = "masque";
    public static final String STATUT_SUPPRIME = "supprime";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "salon_id", nullable = false)
    private UUID salonId;

    @Column(name = "auteur_id", nullable = false)
    private UUID auteurId;

    @Column(name = "corps", nullable = false)
    private String corps;

    @Column(name = "statut", nullable = false)
    private String statut = STATUT_PUBLIE;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "edite_at")
    private Instant editeAt;

    protected SalonMessage() {}

    public SalonMessage(UUID salonId, UUID auteurId, String corps) {
        this.salonId = salonId;
        this.auteurId = auteurId;
        this.corps = corps;
    }

    public void masquer() {
        this.statut = STATUT_MASQUE;
    }

    public boolean estVisible() {
        return STATUT_PUBLIE.equals(statut);
    }

    public UUID getId() {
        return id;
    }

    public UUID getSalonId() {
        return salonId;
    }

    public UUID getAuteurId() {
        return auteurId;
    }

    public String getCorps() {
        return corps;
    }

    public String getStatut() {
        return statut;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getEditeAt() {
        return editeAt;
    }
}
