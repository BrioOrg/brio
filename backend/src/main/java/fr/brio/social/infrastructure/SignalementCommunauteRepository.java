package fr.brio.social.infrastructure;

import fr.brio.social.domain.SignalementCommunaute;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SignalementCommunauteRepository extends JpaRepository<SignalementCommunaute, UUID> {

    boolean existsByCibleTypeAndCibleIdAndSignaleParAndStatut(
            String cibleType, UUID cibleId, UUID signalePar, String statut);

    long countBySignaleParAndCreatedAtAfter(UUID signalePar, Instant depuis);

    List<SignalementCommunaute> findByStatutOrderByCreatedAtAsc(String statut);

    List<SignalementCommunaute> findByCibleTypeAndCibleIdAndStatut(
            String cibleType, UUID cibleId, String statut);
}
