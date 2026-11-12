package fr.brio.social.infrastructure;

import fr.brio.social.domain.QuestionCommunaute;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface QuestionCommunauteRepository extends JpaRepository<QuestionCommunaute, UUID> {

    /** Les plus récentes d'abord ; un filtre null ne filtre pas. */
    @Query("""
            select q from QuestionCommunaute q
            where q.statut = 'publie'
              and (cast(:niveau as string) is null or q.niveau = :niveau)
              and (cast(:matiere as string) is null or q.matiere = :matiere)
            order by q.createdAt desc, q.id
            """)
    Slice<QuestionCommunaute> lister(
            @Param("niveau") String niveau, @Param("matiere") String matiere, Pageable page);

    /** Sérialise les résolutions d'une même question, pour qu'une seule réponse soit retenue. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select q from QuestionCommunaute q where q.id = :id")
    Optional<QuestionCommunaute> verrouiller(@Param("id") UUID id);

    /** Author's questions since the given instant — feeds the preventive rate-limit (every statut). */
    long countByAuteurIdAndCreatedAtAfter(UUID auteurId, Instant depuis);

    /**
     * Rétention (ADR 0023 §6) : au-delà de la fenêtre, la question reste (titre et corps)
     * mais son auteur devient le compte anonyme. Idempotent, renvoie le nombre de lignes
     * anonymisées.
     */
    @Modifying
    @Query(
            """
            update QuestionCommunaute q
               set q.auteurId = :anonyme
             where q.createdAt < :seuil and q.auteurId <> :anonyme
            """)
    int anonymiserAvant(@Param("seuil") Instant seuil, @Param("anonyme") UUID anonyme);
}
