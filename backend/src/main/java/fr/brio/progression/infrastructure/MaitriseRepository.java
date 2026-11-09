package fr.brio.progression.infrastructure;

import fr.brio.progression.domain.Maitrise;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MaitriseRepository extends JpaRepository<Maitrise, Maitrise.MaitriseId> {

    /** All competences with a recorded mastery for this student, for the read API. */
    List<Maitrise> findByIdEleveId(UUID eleveId);

    /**
     * Creates the (student, competence) mastery row if missing, atomically — same first-recompute
     * race as the streak and the balance (#344): two submissions sharing a competence used to both
     * INSERT and collide on the composite key. {@code echantillon} starts at 0; the recompute that
     * follows overwrites it.
     */
    @Modifying
    @Query(value = "INSERT INTO progression.maitrise (eleve_id, competence_code, echantillon) "
            + "VALUES (:eleveId, :code, 0) ON CONFLICT (eleve_id, competence_code) DO NOTHING",
            nativeQuery = true)
    void creerSiAbsent(@Param("eleveId") UUID eleveId, @Param("code") String code);
}
