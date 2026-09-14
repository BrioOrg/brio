package fr.brio.identite.infrastructure;

import fr.brio.identite.domain.Consentement;
import fr.brio.identite.domain.ConsentementId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConsentementRepository extends JpaRepository<Consentement, ConsentementId> {
    Optional<Consentement> findByRevocationTokenHash(String hash);
    List<Consentement> findByIdCompteId(UUID compteId);
}
