package fr.brio.progression.infrastructure;

import fr.brio.progression.domain.SectionLue;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SectionLueRepository extends JpaRepository<SectionLue, UUID> {

    boolean existsByEleveIdAndChapitreIdAndSectionId(UUID eleveId, String chapitreId, String sectionId);

    long countByEleveIdAndChapitreId(UUID eleveId, String chapitreId);

    /** Read count and latest read per chapter for a student, most recent first. */
    @Query("""
            select new fr.brio.progression.infrastructure.SectionLueRepository$LectureChapitre(
                       s.chapitreId, count(s), max(s.luAt))
            from SectionLue s
            where s.eleveId = :eleveId
            group by s.chapitreId
            order by max(s.luAt) desc
            """)
    List<LectureChapitre> lecturesParChapitre(@Param("eleveId") UUID eleveId);

    record LectureChapitre(String chapitreId, long sectionsLues, Instant derniereLecture) {}
}
