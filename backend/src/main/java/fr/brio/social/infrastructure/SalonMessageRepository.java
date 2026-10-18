package fr.brio.social.infrastructure;

import fr.brio.social.domain.SalonMessage;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SalonMessageRepository extends JpaRepository<SalonMessage, UUID> {

    List<SalonMessage> findBySalonIdOrderByCreatedAtAsc(UUID salonId);

    long countByAuteurIdAndCreatedAtAfter(UUID auteurId, Instant depuis);
}
