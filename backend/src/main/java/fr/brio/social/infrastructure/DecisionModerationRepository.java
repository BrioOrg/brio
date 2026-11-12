package fr.brio.social.infrastructure;

import fr.brio.social.domain.DecisionModeration;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DecisionModerationRepository extends JpaRepository<DecisionModeration, UUID> {

    List<DecisionModeration> findByCibleTypeAndCibleIdOrderByCreatedAtDesc(String cibleType, UUID cibleId);

    boolean existsByCibleTypeAndCibleIdAndAction(String cibleType, UUID cibleId, String action);

    /** La décision contestable la plus récente (masquer / supprimer) sur une cible. */
    Optional<DecisionModeration> findFirstByCibleTypeAndCibleIdAndActionInOrderByCreatedAtDesc(
            String cibleType, UUID cibleId, Collection<String> actions);
}
