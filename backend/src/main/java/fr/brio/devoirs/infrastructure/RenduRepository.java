package fr.brio.devoirs.infrastructure;

import fr.brio.devoirs.domain.Rendu;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RenduRepository extends JpaRepository<Rendu, UUID> {

    Optional<Rendu> findByDevoirIdAndEleveId(UUID devoirId, UUID eleveId);

    List<Rendu> findByEleveIdAndDevoirIdIn(UUID eleveId, Collection<UUID> devoirIds);

    List<Rendu> findByDevoirId(UUID devoirId);
}
