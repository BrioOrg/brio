package fr.brio.contenu.infrastructure;

import fr.brio.contenu.domain.CoursVersion;
import fr.brio.contenu.domain.CoursVersionId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoursVersionRepository extends JpaRepository<CoursVersion, CoursVersionId> {
}
