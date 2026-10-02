package fr.brio.contenu.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import fr.brio.contenu.ContentViolation;
import fr.brio.contenu.InvalidContentException;
import fr.brio.contenu.domain.Competence;
import java.util.ArrayList;
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
                    "Unknown competency code(s), absent from the referential: " + String.join(", ", unknown),
                    locate(document, unknown, ContentViolation.UNKNOWN_COMPETENCY));
        }

        Set<String> deprecated = found.stream()
                .filter(Competence::isDeprecated)
                .map(Competence::getCode)
                .collect(TreeSet::new, TreeSet::add, TreeSet::addAll);
        if (!deprecated.isEmpty()) {
            throw new InvalidContentException(
                    "Deprecated competency code(s) — content must reference only active codes: "
                    + String.join(", ", deprecated),
                    locate(document, deprecated, ContentViolation.DEPRECATED_COMPETENCY));
        }
    }

    /**
     * One violation per block citing one of {@code codes}, so the editor can lead to it. A code
     * cited outside any block (chapter-level metadata in catalogue files) gets an unlocated one.
     */
    private static List<ContentViolation> locate(JsonNode document, Set<String> codes, String violationCode) {
        List<ContentViolation> violations = new ArrayList<>();
        Set<String> located = new HashSet<>();
        for (JsonNode section : document.path("sections")) {
            for (JsonNode block : section.path("blocks")) {
                for (JsonNode code : block.path("competencies")) {
                    if (codes.contains(code.asText())) {
                        located.add(code.asText());
                        violations.add(new ContentViolation(
                                violationCode, section.path("id").asText(), block.path("id").asText(), "competencies"));
                        break;
                    }
                }
            }
        }
        if (!located.containsAll(codes)) {
            violations.add(new ContentViolation(violationCode, null, null, "competencies"));
        }
        return violations;
    }
}
