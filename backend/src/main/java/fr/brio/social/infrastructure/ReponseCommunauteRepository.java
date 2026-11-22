package fr.brio.social.infrastructure;

import fr.brio.social.domain.ReponseCommunaute;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReponseCommunauteRepository extends JpaRepository<ReponseCommunaute, UUID> {

    @Query("""
            select r from ReponseCommunaute r
            where r.questionId = :questionId and r.statut = 'publie'
            order by r.createdAt, r.id
            """)
    List<ReponseCommunaute> visibles(@Param("questionId") UUID questionId);

    /** Réponses visibles par question, commentaires exclus. */
    @Query("""
            select r.questionId as cible, count(r) as total
            from ReponseCommunaute r
            where r.questionId in :questionIds and r.parentId is null and r.statut = 'publie'
            group by r.questionId
            """)
    List<VoteCommunauteRepository.Total> compter(@Param("questionIds") Collection<UUID> questionIds);

    /** Author's answers and comments since the given instant — feeds the preventive rate-limit. */
    long countByAuteurIdAndCreatedAtAfter(UUID auteurId, Instant depuis);

    /**
     * Rétention (ADR 0023 §6) : au-delà de la fenêtre, la réponse (ou le commentaire) reste
     * mais son auteur devient le compte anonyme. Idempotent, renvoie le nombre de lignes
     * anonymisées.
     */
    @Modifying
    @Query(
            """
            update ReponseCommunaute r
               set r.auteurId = :anonyme
             where r.createdAt < :seuil and r.auteurId <> :anonyme
            """)
    int anonymiserAvant(@Param("seuil") Instant seuil, @Param("anonyme") UUID anonyme);

    /**
     * Ids of the past-window answers that resolved a question — the only ones that carry an XP
     * reference in {@code progression}: those about to be anonymised, plus those created in the
     * last days before the threshold even if already anonymised ({@code rattrapage}), so an XP
     * written by a {@code resoudre} racing the previous run is still cut. Bounded, and cutting
     * twice is harmless.
     */
    @Query(
            """
            select r.id from ReponseCommunaute r
             where r.createdAt < :seuil
               and (r.auteurId <> :anonyme or r.createdAt >= :rattrapage)
               and exists (select 1 from QuestionCommunaute q where q.reponseResolueId = r.id)
            """)
    List<UUID> utilesAAnonymiser(
            @Param("seuil") Instant seuil,
            @Param("rattrapage") Instant rattrapage,
            @Param("anonyme") UUID anonyme);
}
