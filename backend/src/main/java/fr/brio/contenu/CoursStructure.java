package fr.brio.contenu;

import com.fasterxml.jackson.databind.JsonNode;
import fr.brio.contenu.api.CoursPublie;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Derives the structural {@link CoursPublie} of a published version from its stored content, so
 * the publication and the startup re-announcement compute it the one same way (ADR 0050 §1).
 */
public final class CoursStructure {

    /**
     * The exercise types exercices can grade (its evaluators). Only these count toward a course's
     * completion: {@code paper}, and any type with no evaluator ({@code free-text}, {@code ordering},
     * an unknown type), could never be solved and would block the course (ADR 0050 §5). Kept equal to
     * exercices' evaluators by {@code TypesCorrigeablesTest}.
     */
    public static final Set<String> TYPES_CORRIGEABLES =
            Set.of("multiple-choice", "short-answer", "numeric", "fill-blank");

    private CoursStructure() {}

    static CoursPublie de(UUID coursId, int version, JsonNode contenu) {
        List<String> sections = new ArrayList<>();
        List<String> exercices = new ArrayList<>();
        for (JsonNode section : contenu.path("sections")) {
            sections.add(section.path("id").asText());
            for (JsonNode bloc : section.path("blocks")) {
                if ("exercise".equals(bloc.path("type").asText())
                        && TYPES_CORRIGEABLES.contains(bloc.path("exerciseType").asText())) {
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
