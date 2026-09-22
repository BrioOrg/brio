package fr.brio.contenu.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import fr.brio.contenu.InvalidContentException;
import fr.brio.contenu.domain.Competence;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.stereotype.Component;

/**
 * Checks that every competency code a document references (in {@code objectives} blocks or
 * exercises) exists in the referential and is active. Shared by catalogue ingestion (ADR 0010)
 * and teacher-course publication (ADR 0019 §4) so an unknown code blocks both paths identically.
 */
@Component
class ContentReferentialValidator {

    private final CompetenceRepository competenceRepository;

    ContentReferentialValidator(CompetenceRepository competenceRepository) {
        this.competenceRepository = competenceRepository;
    }

    void assertCompetenciesExist(JsonNode document) {
        Set<String> referenced = new TreeSet<>();
        document.findValues("competencies")
                .forEach(array -> array.forEach(code -> referenced.add(code.asText())));
        if (referenced.isEmpty()) {
            return;
        }
        List<Competence> found = competenceRepository.findAllById(referenced);
        Set<String> foundCodes = found.stream()
                .map(Competence::getCode)
                .collect(HashSet::new, HashSet::add, HashSet::addAll);

        Set<String> unknown = new TreeSet<>(referenced);
        unknown.removeAll(foundCodes);
        if (!unknown.isEmpty()) {
            throw new InvalidContentException(
                    "Unknown competency code(s), absent from the referential: " + String.join(", ", unknown));
        }

        Set<String> deprecated = found.stream()
                .filter(Competence::isDeprecated)
                .map(Competence::getCode)
                .collect(TreeSet::new, TreeSet::add, TreeSet::addAll);
        if (!deprecated.isEmpty()) {
            throw new InvalidContentException(
                    "Deprecated competency code(s) — content must reference only active codes: "
                    + String.join(", ", deprecated));
        }
    }
}
