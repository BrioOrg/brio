package fr.brio.contenu;

import com.fasterxml.jackson.databind.JsonNode;
import fr.brio.contenu.api.CoursPublie;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Derives the structural {@link CoursPublie} of a published version from its stored content, so
 * the publication and the startup re-announcement compute it the one same way (ADR 0050 §1).
 */
final class CoursStructure {

    /** An exercise solved on paper has no evaluator: it is never counted (ADR 0050 §5). */
    static final String TYPE_SANS_EVALUATEUR = "paper";

    private CoursStructure() {}

    static CoursPublie de(UUID coursId, int version, JsonNode contenu) {
        List<String> sections = new ArrayList<>();
        List<String> exercices = new ArrayList<>();
        for (JsonNode section : contenu.path("sections")) {
            sections.add(section.path("id").asText());
            for (JsonNode bloc : section.path("blocks")) {
                if ("exercise".equals(bloc.path("type").asText())
                        && !TYPE_SANS_EVALUATEUR.equals(bloc.path("exerciseType").asText())) {
                    exercices.add(bloc.path("id").asText());
                }
            }
        }
        return new CoursPublie(coursId, version, sections, exercices);
    }

    /** Whether the version's content has a section with this id. */
    static boolean contientSection(JsonNode contenu, String sectionId) {
        for (JsonNode section : contenu.path("sections")) {
            if (sectionId.equals(section.path("id").asText())) {
                return true;
            }
        }
        return false;
    }
}
