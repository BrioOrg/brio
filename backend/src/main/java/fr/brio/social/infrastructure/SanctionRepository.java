package fr.brio.social.infrastructure;

import fr.brio.social.domain.Sanction;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SanctionRepository extends JpaRepository<Sanction, UUID> {

    List<Sanction> findByCompteIdAndType(UUID compteId, String type);
}
