package fr.brio.contenu.infrastructure;

import fr.brio.contenu.domain.Matiere;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatiereRepository extends JpaRepository<Matiere, String> {}
