package fr.brio.contenu.infrastructure;

import fr.brio.contenu.domain.Competence;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompetenceRepository extends JpaRepository<Competence, String> {}
