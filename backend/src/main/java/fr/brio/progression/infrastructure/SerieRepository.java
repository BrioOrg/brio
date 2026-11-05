package fr.brio.progression.infrastructure;

import fr.brio.progression.domain.Serie;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SerieRepository extends JpaRepository<Serie, UUID> {

    /**
     * Creates the student's streak row if it is missing, atomically. Two first-activity events
     * landing at once for the same student used to both find no row, both INSERT, and the second
     * blew up on {@code series_pkey} — rolling back the whole award and silently losing its XP
     * (#344). The loser's {@code ON CONFLICT} is now a no-op instead of a duplicate-key error.
     */
    @Modifying
    @Query(value = "INSERT INTO progression.series (eleve_id) VALUES (:eleveId) "
            + "ON CONFLICT (eleve_id) DO NOTHING", nativeQuery = true)
    void creerSiAbsent(@Param("eleveId") UUID eleveId);
}
