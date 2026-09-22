package fr.brio.contenu.infrastructure;

import fr.brio.contenu.domain.Cours;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoursRepository extends JpaRepository<Cours, UUID> {

    List<Cours> findByAuteurId(UUID auteurId);
}
