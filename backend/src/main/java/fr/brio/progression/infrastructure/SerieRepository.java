package fr.brio.progression.infrastructure;

import fr.brio.progression.domain.Serie;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SerieRepository extends JpaRepository<Serie, UUID> {}
