package fr.brio.contenu.infrastructure;

import fr.brio.contenu.domain.Competence;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompetenceRepository extends JpaRepository<Competence, String> {

    /**
     * Active competencies only (deprecated codes have a non-null {@code deprecatedSince}), ordered
     * by code so the picker list is stable. Deprecated codes stay in the DB forever (ADR 0009 freeze
     * policy) but must never be offered for authoring.
     */
    List<Competence> findByDeprecatedSinceIsNullOrderByCodeAsc();
}
