package fr.brio.social.infrastructure;

import fr.brio.social.domain.Message;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    List<Message> findByFilIdOrderByCreatedAtAsc(UUID filId);

    long countByFilIdAndStatut(UUID filId, String statut);

    long countByAuteurIdAndCreatedAtAfter(UUID auteurId, Instant depuis);
}
