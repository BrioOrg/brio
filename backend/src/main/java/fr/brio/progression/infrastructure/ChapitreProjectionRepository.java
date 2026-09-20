package fr.brio.progression.infrastructure;

import fr.brio.progression.domain.Chapitre;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChapitreProjectionRepository extends JpaRepository<Chapitre, String> {

    /** Chapters of one track, in path order — the atlas enumeration (published only). */
    List<Chapitre> findByNiveauCodeAndMatiereCodeAndStatutOrderByOrdreAsc(
            String niveauCode, String matiereCode, String statut);
}
