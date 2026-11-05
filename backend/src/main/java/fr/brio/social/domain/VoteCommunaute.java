package fr.brio.social.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Un vote « Utile », posé par {@code VoteCommunauteRepository} pour rester idempotent (ADR 0035 §5). */
@Entity
@Table(name = "communaute_votes", schema = "social")
public class VoteCommunaute {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "compte_id", nullable = false)
    private UUID compteId;

    @Column(name = "question_id")
    private UUID questionId;

    @Column(name = "reponse_id")
    private UUID reponseId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected VoteCommunaute() {}

    public UUID getQuestionId() {
        return questionId;
    }

    public UUID getReponseId() {
        return reponseId;
    }
}
