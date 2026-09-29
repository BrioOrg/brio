package fr.brio.devoirs.infrastructure;

import fr.brio.devoirs.domain.RenduExercice;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RenduExerciceRepository extends JpaRepository<RenduExercice, UUID> {

    Optional<RenduExercice> findByRenduIdAndExerciceId(UUID renduId, UUID exerciceId);

    List<RenduExercice> findByRenduId(UUID renduId);
}
