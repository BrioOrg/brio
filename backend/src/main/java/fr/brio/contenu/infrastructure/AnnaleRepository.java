package fr.brio.contenu.infrastructure;

import fr.brio.contenu.domain.Annale;
import java.util.List;
import java.util.Set;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AnnaleRepository extends JpaRepository<Annale, String> {

    /** Les ids de chapitre qui sont des annales (pour exclure du catalogue des cours). */
    @Query("select a.chapitreId from Annale a")
    Set<String> findAllChapitreIds();

    List<Annale> findAllByOrderByAnneeDescSessionAsc();
}
