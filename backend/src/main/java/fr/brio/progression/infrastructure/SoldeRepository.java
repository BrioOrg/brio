package fr.brio.progression.infrastructure;

import fr.brio.progression.domain.Solde;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SoldeRepository extends JpaRepository<Solde, UUID> {}
