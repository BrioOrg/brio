package fr.brio.contenu.infrastructure;

import fr.brio.contenu.domain.Cours;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoursRepository extends JpaRepository<Cours, UUID> {
}
