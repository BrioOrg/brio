package fr.brio.social.infrastructure;

import fr.brio.social.domain.VoteCommunaute;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VoteCommunauteRepository extends JpaRepository<VoteCommunaute, UUID> {

    /** Un total par cible (question ou réponse). */
    interface Total {
        UUID getCible();

        long getTotal();
    }

    // ON CONFLICT : deux clics simultanés restent un seul vote, sans erreur.
    @Modifying
    @Query(nativeQuery = true, value = """
            insert into social.communaute_votes (compte_id, question_id)
            values (:compteId, :questionId)
            on conflict do nothing
            """)
    void voterQuestion(@Param("compteId") UUID compteId, @Param("questionId") UUID questionId);

    @Modifying
    @Query(nativeQuery = true, value = """
            insert into social.communaute_votes (compte_id, reponse_id)
            values (:compteId, :reponseId)
            on conflict do nothing
            """)
    void voterReponse(@Param("compteId") UUID compteId, @Param("reponseId") UUID reponseId);

    @Modifying
    @Query("delete from VoteCommunaute v where v.compteId = :compteId and v.questionId = :questionId")
    void retirerQuestion(@Param("compteId") UUID compteId, @Param("questionId") UUID questionId);

    @Modifying
    @Query("delete from VoteCommunaute v where v.compteId = :compteId and v.reponseId = :reponseId")
    void retirerReponse(@Param("compteId") UUID compteId, @Param("reponseId") UUID reponseId);

    @Query("""
            select v.questionId as cible, count(v) as total from VoteCommunaute v
            where v.questionId in :ids group by v.questionId
            """)
    List<Total> compterQuestions(@Param("ids") Collection<UUID> ids);

    @Query("""
            select v.reponseId as cible, count(v) as total from VoteCommunaute v
            where v.reponseId in :ids group by v.reponseId
            """)
    List<Total> compterReponses(@Param("ids") Collection<UUID> ids);

    @Query("select v.questionId from VoteCommunaute v where v.compteId = :compteId and v.questionId in :ids")
    Set<UUID> questionsVotees(@Param("compteId") UUID compteId, @Param("ids") Collection<UUID> ids);

    @Query("select v.reponseId from VoteCommunaute v where v.compteId = :compteId and v.reponseId in :ids")
    Set<UUID> reponsesVotees(@Param("compteId") UUID compteId, @Param("ids") Collection<UUID> ids);
}
