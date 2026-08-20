package fr.brio.contenu.infrastructure;

import fr.brio.contenu.domain.Niveau;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NiveauRepository extends JpaRepository<Niveau, String> {
    List<Niveau> findAllByOrderByOrdreAsc();
}
