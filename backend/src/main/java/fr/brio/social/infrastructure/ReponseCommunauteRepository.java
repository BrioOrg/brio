package fr.brio.social.infrastructure;

import fr.brio.social.domain.ReponseCommunaute;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
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
}
