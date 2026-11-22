package fr.brio.social.infrastructure;

import fr.brio.social.domain.Fil;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FilRepository extends JpaRepository<Fil, UUID> {

    List<Fil> findByClasseIdAndPorteeAndPorteeRefOrderByCreatedAtDesc(
            UUID classeId, String portee, String porteeRef);

    /**
     * Retention (ADR 0023 §6): past the window the thread (its title) stays but its author
     * becomes the anonymous account. The thread's author also wrote its first message, so
     * leaving it would give the anonymised question back. Idempotent, returns the row count.
     */
    @Modifying
    @Query(
            """
            update Fil f
               set f.auteurId = :anonyme
             where f.createdAt < :seuil and f.auteurId <> :anonyme
            """)
    int anonymiserAvant(@Param("seuil") Instant seuil, @Param("anonyme") UUID anonyme);
}
