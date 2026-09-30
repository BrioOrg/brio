package fr.brio.identite.infrastructure;

import fr.brio.identite.domain.Compte;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CompteRepository extends JpaRepository<Compte, UUID> {
    Optional<Compte> findByIdentifiantConnexion(String identifiantConnexion);

    /** Adult accounts only carry an e-mail; unique case-insensitively (V34). */
    Optional<Compte> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);
}
