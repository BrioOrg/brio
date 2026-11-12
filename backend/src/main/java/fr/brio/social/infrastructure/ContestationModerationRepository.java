package fr.brio.social.infrastructure;

import fr.brio.social.domain.ContestationModeration;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContestationModerationRepository extends JpaRepository<ContestationModeration, UUID> {

    boolean existsByDecisionId(UUID decisionId);

    List<ContestationModeration> findByStatutOrderByCreatedAtAsc(String statut);
}
