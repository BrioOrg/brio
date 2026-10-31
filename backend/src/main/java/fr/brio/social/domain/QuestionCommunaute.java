package fr.brio.social.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Une question de la Communauté (ADR 0035). */
@Entity
@Table(name = "communaute_questions", schema = "social")
public class QuestionCommunaute {

    public static final String STATUT_PUBLIE = "publie";
    public static final String STATUT_SUPPRIME = "supprime";

    /** Ce qui reste d'un message supprimé : son auteur a demandé qu'il disparaisse. */
    static final String CORPS_VIDE = "[]";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "auteur_id", nullable = false)
    private UUID auteurId;

    @Column(name = "titre", nullable = false)
    private String titre;

    @Column(name = "corps", nullable = false)
    @JdbcTypeCode(SqlTypes.JSON)
    private String corps;

    @Column(name = "niveau")
    private String niveau;

    @Column(name = "matiere", nullable = false)
    private String matiere;

    @Column(name = "statut", nullable = false)
    private String statut = STATUT_PUBLIE;

    @Column(name = "reponse_resolue_id")
    private UUID reponseResolueId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "edite_at")
    private Instant editeAt;

    protected QuestionCommunaute() {}

    public QuestionCommunaute(UUID auteurId, String titre, String corps, String niveau, String matiere) {
        this.auteurId = auteurId;
        this.titre = titre;
        this.corps = corps;
        this.niveau = niveau;
        this.matiere = matiere;
    }

    public void modifier(String nouveauTitre, String nouveauCorps, Instant quand) {
        this.titre = nouveauTitre;
        this.corps = nouveauCorps;
        this.editeAt = quand;
    }

    public void supprimer() {
        this.statut = STATUT_SUPPRIME;
        this.titre = "";
        this.corps = CORPS_VIDE;
    }

    public void resoudre(UUID reponseId) {
        this.reponseResolueId = reponseId;
    }

    public void annulerResolution() {
        this.reponseResolueId = null;
    }

    public boolean estVisible() {
        return STATUT_PUBLIE.equals(statut);
    }

    public UUID getId() {
        return id;
    }

    public UUID getAuteurId() {
        return auteurId;
    }

    public String getTitre() {
        return titre;
    }

    public String getCorps() {
        return corps;
    }

    public String getNiveau() {
        return niveau;
    }

    public String getMatiere() {
        return matiere;
    }

    public UUID getReponseResolueId() {
        return reponseResolueId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getEditeAt() {
        return editeAt;
    }
}
