package fr.brio.exercices.infrastructure;

import fr.brio.exercices.domain.Soumission;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SoumissionRepository extends JpaRepository<Soumission, UUID> {}
