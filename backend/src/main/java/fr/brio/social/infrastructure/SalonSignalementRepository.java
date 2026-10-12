package fr.brio.social.infrastructure;

import fr.brio.social.domain.SalonSignalement;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SalonSignalementRepository extends JpaRepository<SalonSignalement, UUID> {

    boolean existsByMessageIdAndSignalePar(UUID messageId, UUID signalePar);

    List<SalonSignalement> findByStatutOrderByCreatedAtAsc(String statut);
}
