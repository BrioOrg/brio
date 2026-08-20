package fr.brio.contenu.infrastructure;

import fr.brio.contenu.domain.Chapitre;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChapitreRepository extends JpaRepository<Chapitre, String> {

    List<Chapitre> findByStatutOrderByNiveauCodeAscMatiereCodeAscOrdreAsc(String statut);

    Optional<Chapitre> findByNiveauCodeAndMatiereCodeAndId(
            String niveauCode, String matiereCode, String id);
}
