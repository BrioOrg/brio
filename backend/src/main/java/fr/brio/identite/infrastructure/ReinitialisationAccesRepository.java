package fr.brio.identite.infrastructure;

import fr.brio.identite.domain.ReinitialisationAcces;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Audit trail of access resets (ADR 0036 §7), also counted for their rate limit (§6). */
public interface ReinitialisationAccesRepository extends JpaRepository<ReinitialisationAcces, UUID> {

    long countByParCompteIdAndCreeLeAfter(UUID parCompteId, Instant depuis);

    long countByCompteIdAndCreeLeAfter(UUID compteId, Instant depuis);

    List<ReinitialisationAcces> findByCompteId(UUID compteId);
}
