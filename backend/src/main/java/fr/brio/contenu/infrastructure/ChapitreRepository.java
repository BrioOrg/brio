package fr.brio.contenu.infrastructure;

import fr.brio.contenu.domain.Chapitre;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChapitreRepository extends JpaRepository<Chapitre, String> {}
