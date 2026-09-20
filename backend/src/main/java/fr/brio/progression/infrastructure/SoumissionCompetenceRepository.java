package fr.brio.progression.infrastructure;

import fr.brio.progression.domain.SoumissionCompetence;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SoumissionCompetenceRepository extends JpaRepository<SoumissionCompetence, UUID> {

    boolean existsBySoumissionIdAndCompetenceCode(UUID soumissionId, String competenceCode);

    /**
     * The most recent first attempts on a competence, newest first — the mastery window.
     * First attempts only, so redoing an exercise cannot flood the sample (ADR 0022 §6).
     * The caller bounds it to {@code NiveauMaitrise.FENETRE} via {@code Pageable}.
     */
    @Query("select s from SoumissionCompetence s "
            + "where s.eleveId = :eleveId and s.competenceCode = :code and s.premiereTentative = true "
            + "order by s.submittedAt desc")
    List<SoumissionCompetence> fenetre(
            @Param("eleveId") UUID eleveId, @Param("code") String code, Pageable pageable);

    /** Every competence this student has submitted to — the set to recompute. */
    @Query("select distinct s.competenceCode from SoumissionCompetence s where s.eleveId = :eleveId")
    List<String> competencesDeLEleve(@Param("eleveId") UUID eleveId);
}
