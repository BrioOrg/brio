package fr.brio.identite.infrastructure;

import fr.brio.identite.domain.DemandeConsentement;
import fr.brio.identite.domain.DemandeConsentementId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface DemandeConsentementRepository extends JpaRepository<DemandeConsentement, DemandeConsentementId> {
    Optional<DemandeConsentement> findByTokenHash(String hash);
    Optional<DemandeConsentement> findByIdCompteIdAndIdType(UUID compteId, String type);
}
