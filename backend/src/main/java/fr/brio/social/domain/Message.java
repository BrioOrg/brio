package fr.brio.social.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Un message dans un fil d'entraide (ADR 0023). */
@Entity
@Table(name = "messages", schema = "social")
public class Message {

    public static final String STATUT_PUBLIE = "publie";
    public static final String STATUT_EN_MODERATION = "en_moderation";
    public static final String STATUT_MASQUE = "masque";
    public static final String STATUT_SUPPRIME = "supprime";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "fil_id", nullable = false)
    private UUID filId;

    @Column(name = "auteur_id", nullable = false)
    private UUID auteurId;

    @Column(name = "corps", nullable = false)
    private String corps;

    @Column(name = "statut", nullable = false)
    private String statut = STATUT_PUBLIE;

    @Column(name = "marque_utile_at")
    private Instant marqueUtileAt;

    @Column(name = "marque_utile_par")
    private UUID marqueUtilePar;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "edite_at")
    private Instant editeAt;

    protected Message() {}

    public Message(UUID filId, UUID auteurId, String corps) {
        this.filId = filId;
        this.auteurId = auteurId;
        this.corps = corps;
    }

    /** Marque ce message comme utile, retenu par l'auteur du fil. */
    public void marquerUtile(UUID parAuteurDuFil, Instant quand) {
        this.marqueUtileAt = quand;
        this.marqueUtilePar = parAuteurDuFil;
    }

    public void masquer() {
        this.statut = STATUT_MASQUE;
    }

    public boolean estUtile() {
        return marqueUtileAt != null;
    }

    public boolean estVisible() {
        return STATUT_PUBLIE.equals(statut);
    }

    public UUID getId() {
        return id;
    }

    public UUID getFilId() {
        return filId;
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

    public Instant getMarqueUtileAt() {
        return marqueUtileAt;
    }

    public UUID getMarqueUtilePar() {
        return marqueUtilePar;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getEditeAt() {
        return editeAt;
    }
}
