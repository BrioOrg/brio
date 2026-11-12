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
 * Contestation d'une décision de modération par l'auteur du contenu, tranchée par un humain
 * (suivi #338). Accepter restaure le contenu ; rejeter laisse la décision en place. Dans les
 * deux cas l'admin laisse une réponse.
 */
@Entity
@Table(name = "communaute_contestations", schema = "social")
public class ContestationModeration {

    public static final String STATUT_OUVERTE = "ouverte";
    public static final String STATUT_ACCEPTEE = "acceptee";
    public static final String STATUT_REJETEE = "rejetee";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "decision_id", nullable = false)
    private UUID decisionId;

    @Column(name = "cible_type", nullable = false)
    private String cibleType;

    @Column(name = "cible_id", nullable = false)
    private UUID cibleId;

    @Column(name = "auteur_id", nullable = false)
    private UUID auteurId;

    @Column(name = "message", nullable = false)
    private String message;

    @Column(name = "statut", nullable = false)
    private String statut = STATUT_OUVERTE;

    @Column(name = "reponse_moderateur")
    private String reponseModerateur;

    @Column(name = "traite_par")
    private UUID traitePar;

    @Column(name = "traite_at")
    private Instant traiteAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected ContestationModeration() {}

    public ContestationModeration(
            UUID decisionId, CibleCommunaute cible, UUID cibleId, UUID auteurId, String message) {
        this.decisionId = decisionId;
        this.cibleType = cible.code();
        this.cibleId = cibleId;
        this.auteurId = auteurId;
        this.message = message;
    }

    /** Tranche la contestation : {@code accepter} true = acceptée (contenu restauré), false = rejetée. */
    public void trancher(boolean accepter, String reponse, UUID parAdmin, Instant quand) {
        this.statut = accepter ? STATUT_ACCEPTEE : STATUT_REJETEE;
        this.reponseModerateur = reponse;
        this.traitePar = parAdmin;
        this.traiteAt = quand;
    }

    public boolean estOuverte() {
        return STATUT_OUVERTE.equals(statut);
    }

    public UUID getId() {
        return id;
    }

    public UUID getDecisionId() {
        return decisionId;
    }

    public CibleCommunaute getCible() {
        return CibleCommunaute.depuisCode(cibleType);
    }

    public UUID getCibleId() {
        return cibleId;
    }

    public UUID getAuteurId() {
        return auteurId;
    }

    public String getMessage() {
        return message;
    }

    public String getStatut() {
        return statut;
    }

    public String getReponseModerateur() {
        return reponseModerateur;
    }

    public Instant getTraiteAt() {
        return traiteAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
