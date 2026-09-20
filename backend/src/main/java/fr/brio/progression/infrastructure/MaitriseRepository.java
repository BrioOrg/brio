package fr.brio.progression.infrastructure;

import fr.brio.progression.domain.Maitrise;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MaitriseRepository extends JpaRepository<Maitrise, Maitrise.MaitriseId> {

    /** All competences with a recorded mastery for this student, for the read API. */
    List<Maitrise> findByIdEleveId(UUID eleveId);
}
