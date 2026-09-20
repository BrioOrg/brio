package fr.brio.progression.infrastructure;

import fr.brio.progression.domain.ExerciceReussi;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExerciceReussiRepository extends JpaRepository<ExerciceReussi, UUID> {

    boolean existsByEleveIdAndChapitreIdAndExerciceId(UUID eleveId, String chapitreId, UUID exerciceId);

    long countByEleveIdAndChapitreId(UUID eleveId, String chapitreId);
}
