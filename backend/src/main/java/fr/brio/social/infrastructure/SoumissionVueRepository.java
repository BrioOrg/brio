package fr.brio.social.infrastructure;

import fr.brio.social.domain.SoumissionVue;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SoumissionVueRepository extends JpaRepository<SoumissionVue, SoumissionVue.Cle> {

    boolean existsByEleveIdAndExerciceId(UUID eleveId, UUID exerciceId);
}
