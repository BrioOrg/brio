package fr.brio.social.infrastructure;

import fr.brio.social.domain.Salon;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SalonRepository extends JpaRepository<Salon, UUID> {

    List<Salon> findByClasseIdInOrderByCreatedAtAsc(Collection<UUID> classeIds);
}
