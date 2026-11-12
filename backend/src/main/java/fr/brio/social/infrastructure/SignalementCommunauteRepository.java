package fr.brio.social.infrastructure;

import fr.brio.social.domain.SignalementCommunaute;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SignalementCommunauteRepository extends JpaRepository<SignalementCommunaute, UUID> {

    boolean existsByCibleTypeAndCibleIdAndSignalePar(String cibleType, UUID cibleId, UUID signalePar);

    List<SignalementCommunaute> findByStatutOrderByCreatedAtAsc(String statut);

    List<SignalementCommunaute> findByCibleTypeAndCibleIdAndStatut(
            String cibleType, UUID cibleId, String statut);
}
