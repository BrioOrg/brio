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
     * become the anonymous account, and the "marked useful" instant falls back to the creation
     * instant: the XP that marking earned is stamped with that very instant in {@code
     * progression}, so keeping it would let a join on time give the author back. The "useful"
     * badge stays. Idempotent: fully anonymised rows are skipped. A row whose author is already
     * anonymous but whose "marked useful by" was written back afterwards (a concurrent {@code
     * marquerUtile} that loaded the row before the purge) is caught again. Returns the row count.
     */
    @Modifying
    @Query(
            """
            update Message m
               set m.auteurId = :anonyme,
                   m.marqueUtilePar = case when m.marqueUtilePar is not null then :anonyme else null end,
                   m.marqueUtileAt = case when m.marqueUtileAt is not null then m.createdAt else null end
             where m.createdAt < :seuil
               and (m.auteurId <> :anonyme or m.marqueUtilePar <> :anonyme)
            """)
    int anonymiserAvant(@Param("seuil") Instant seuil, @Param("anonyme") UUID anonyme);

    /**
     * Ids of the past-window messages marked useful — the only ones that carry an XP reference
     * in {@code progression}: those about to be anonymised, plus those created in the last days
     * before the threshold even if already anonymised ({@code rattrapage}), so an XP written by
     * a {@code marquerUtile} racing the previous run is still cut. Bounded, and cutting twice is
     * harmless.
     */
    @Query(
            """
            select m.id from Message m
             where m.createdAt < :seuil and m.marqueUtileAt is not null
               and (m.auteurId <> :anonyme or m.marqueUtilePar <> :anonyme or m.createdAt >= :rattrapage)
            """)
    List<UUID> utilesAAnonymiser(
            @Param("seuil") Instant seuil,
            @Param("rattrapage") Instant rattrapage,
            @Param("anonyme") UUID anonyme);
}
