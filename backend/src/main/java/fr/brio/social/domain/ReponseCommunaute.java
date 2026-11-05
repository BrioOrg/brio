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

/** Une réponse à une question de la Communauté, ou un commentaire si elle a un parent (ADR 0035). */
@Entity
@Table(name = "communaute_reponses", schema = "social")
public class ReponseCommunaute {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "question_id", nullable = false)
    private UUID questionId;

    @Column(name = "parent_id")
    private UUID parentId;

    @Column(name = "auteur_id", nullable = false)
    private UUID auteurId;

    @Column(name = "corps", nullable = false)
    @JdbcTypeCode(SqlTypes.JSON)
    private String corps;

    @Column(name = "statut", nullable = false)
    private String statut = QuestionCommunaute.STATUT_PUBLIE;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "edite_at")
    private Instant editeAt;

    protected ReponseCommunaute() {}

    public ReponseCommunaute(UUID questionId, UUID parentId, UUID auteurId, String corps) {
        this.questionId = questionId;
        this.parentId = parentId;
        this.auteurId = auteurId;
        this.corps = corps;
    }

    public void modifier(String nouveauCorps, Instant quand) {
        this.corps = nouveauCorps;
        this.editeAt = quand;
    }

    public void supprimer() {
        this.statut = QuestionCommunaute.STATUT_SUPPRIME;
        this.corps = QuestionCommunaute.CORPS_VIDE;
    }

    public boolean estCommentaire() {
        return parentId != null;
    }

    public boolean estVisible() {
        return QuestionCommunaute.STATUT_PUBLIE.equals(statut);
    }

    public UUID getId() {
        return id;
    }

    public UUID getQuestionId() {
        return questionId;
    }

    public UUID getParentId() {
        return parentId;
    }

    public UUID getAuteurId() {
        return auteurId;
    }

    public String getCorps() {
        return corps;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getEditeAt() {
        return editeAt;
    }
}
