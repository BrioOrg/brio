package fr.brio.social.infrastructure;

import fr.brio.social.domain.Signalement;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SignalementRepository extends JpaRepository<Signalement, UUID> {

    boolean existsByMessageIdAndSignalePar(UUID messageId, UUID signalePar);

    List<Signalement> findByStatutOrderByCreatedAtAsc(String statut);
}
