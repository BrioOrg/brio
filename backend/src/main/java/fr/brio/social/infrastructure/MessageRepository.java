package fr.brio.social.infrastructure;

import fr.brio.social.domain.Message;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    List<Message> findByFilIdOrderByCreatedAtAsc(UUID filId);

    long countByFilIdAndStatut(UUID filId, String statut);

    long countByAuteurIdAndCreatedAtAfter(UUID auteurId, Instant depuis);

    /**
     * Retention (ADR 0023 §6): past the window the content stays but its link to people
     * (identification data, LCEN) is cut — the author and the optional "marked useful by"
     * become the anonymous account. Idempotent: fully anonymised rows are skipped. A row whose
     * author is already anonymous but whose "marked useful by" was written back afterwards (a
     * concurrent {@code marquerUtile} that loaded the row before the purge) is caught again.
     * Returns the number of rows anonymised.
     */
    @Modifying
    @Query(
            """
            update Message m
               set m.auteurId = :anonyme,
                   m.marqueUtilePar = case when m.marqueUtilePar is not null then :anonyme else null end
             where m.createdAt < :seuil
               and (m.auteurId <> :anonyme or m.marqueUtilePar <> :anonyme)
            """)
    int anonymiserAvant(@Param("seuil") Instant seuil, @Param("anonyme") UUID anonyme);

    /**
     * Ids of the messages {@link #anonymiserAvant} is about to anonymise that were marked
     * useful — the only ones that carry an XP reference in {@code progression}. Same predicate.
     */
    @Query(
            """
            select m.id from Message m
             where m.createdAt < :seuil and m.marqueUtileAt is not null
               and (m.auteurId <> :anonyme or m.marqueUtilePar <> :anonyme)
            """)
    List<UUID> utilesAAnonymiser(@Param("seuil") Instant seuil, @Param("anonyme") UUID anonyme);
}
