package fr.brio.progression.infrastructure;

import fr.brio.progression.domain.SectionLue;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SectionLueRepository extends JpaRepository<SectionLue, UUID> {

    boolean existsByEleveIdAndChapitreIdAndSectionId(UUID eleveId, String chapitreId, String sectionId);

    long countByEleveIdAndChapitreId(UUID eleveId, String chapitreId);
}
