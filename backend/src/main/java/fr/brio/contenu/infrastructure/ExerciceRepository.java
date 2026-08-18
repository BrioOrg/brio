package fr.brio.contenu.infrastructure;

import fr.brio.contenu.domain.Exercice;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExerciceRepository extends JpaRepository<Exercice, UUID> {

    Optional<Exercice> findByChapitreIdAndSlug(String chapitreId, String slug);
}
