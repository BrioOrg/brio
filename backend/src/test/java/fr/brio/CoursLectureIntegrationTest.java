package fr.brio;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.ContenuService;
import fr.brio.contenu.CoursEditionService;
import fr.brio.contenu.CoursLectureService;
import fr.brio.contenu.api.ChapitreContentApi;
import fr.brio.contenu.api.ChapitreDocument;
import fr.brio.contenu.api.CreerBrouillonCommand;
import fr.brio.contenu.api.ExerciseBlock;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * Reading a published teacher course as a scoped student (ADR 0019 §1). Access-control
 * logic is exercised at the service/api layer, passing class IDs by value the way the
 * controller resolves them from identite. The end-to-end HTTP wiring (401/403/404) is
 * covered by {@link CoursControllerIntegrationTest}.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class CoursLectureIntegrationTest {

    @Autowired CoursEditionService coursEditionService;
    @Autowired CoursLectureService coursLectureService;
    @Autowired ChapitreContentApi chapitreContentApi;
    @Autowired ObjectMapper objectMapper;

    private JsonNode draftContent() throws Exception {
        return objectMapper.readTree("""
                {
                  "schemaVersion": 1,
                  "id": "cours-enseignant",
                  "title": "Mon cours",
                  "sections": [
                    { "id": "s1", "title": "Leçon", "kind": "lesson", "blocks": [
                      { "id": "p1", "type": "prose", "text": "Bonjour" },
                      { "id": "img1", "type": "image", "asset": "a.svg", "alt": "un schéma" },
                      { "id": "ex-num", "type": "exercise", "exerciseType": "numeric",
                        "prompt": "Hypoténuse de 3 et 4 ?",
                        "competencies": ["c4.geo.pythagore.calculer"],
                        "answer": 5, "tolerance": 0.01 }
                    ] }
                  ]
                }
                """);
    }

    private UUID publishCourseScopedTo(UUID classeId) throws Exception {
        UUID coursId = coursEditionService.creerBrouillon(new CreerBrouillonCommand(
                UUID.randomUUID(), UUID.randomUUID(), "Mon cours",
                "3e", "mathematiques", draftContent()));
        coursEditionService.definirPortees(coursId, Set.of(classeId));
        coursEditionService.publier(coursId);
        return coursId;
    }

    @Test
    void shouldServePublishedCourseContentStrippedOfCorrectionFields() throws Exception {
        UUID coursId = publishCourseScopedTo(UUID.randomUUID());

        JsonNode contenu = coursLectureService.contenuPublie(coursId).orElseThrow();

        assertThat(contenu.path("title").asText()).isEqualTo("Mon cours");
        ContenuService.SENSITIVE_EVAL_FIELDS.forEach(field ->
                assertThat(containsKey(contenu, field))
                        .as("Correction field '%s' must never reach the client", field)
                        .isFalse());
        // The exercise block keeps its minted id so the student can submit against it.
        assertThat(containsKey(contenu, "exerciceId")).isTrue();
    }

    @Test
    void shouldExposeAnUnpublishedCourseToNoOne() throws Exception {
        UUID classeId = UUID.randomUUID();
        UUID coursId = coursEditionService.creerBrouillon(new CreerBrouillonCommand(
                UUID.randomUUID(), UUID.randomUUID(), "Brouillon",
                "3e", "mathematiques", draftContent()));
        coursEditionService.definirPortees(coursId, Set.of(classeId));
        // Not published.

        assertThat(coursLectureService.contenuPublie(coursId)).isEmpty();
        assertThat(coursLectureService.estVisiblePour(coursId, Set.of(classeId))).isFalse();
    }

    @Test
    void shouldBeVisibleOnlyToAClassInScope() throws Exception {
        UUID classeEnScope = UUID.randomUUID();
        UUID coursId = publishCourseScopedTo(classeEnScope);

        assertThat(coursLectureService.estVisiblePour(coursId, Set.of(classeEnScope))).isTrue();
        assertThat(coursLectureService.estVisiblePour(coursId, Set.of(UUID.randomUUID()))).isFalse();
        assertThat(coursLectureService.estVisiblePour(coursId, Set.of())).isFalse();
    }

    @Test
    void shouldResolveTheTypedDocumentFromTheCourseOriginThroughTheSameEngine() throws Exception {
        UUID coursId = publishCourseScopedTo(UUID.randomUUID());

        ChapitreDocument doc = chapitreContentApi.findCoursVersionPubliee(coursId).orElseThrow();

        assertThat(doc.id()).isEqualTo("cours-enseignant");
        assertThat(doc.sections()).singleElement()
                .satisfies(s -> assertThat(s.id()).isEqualTo("s1"));
        // The exercise block resolves with a minted id — same shape the tutor consumes for a chapter.
        ExerciseBlock ex = (ExerciseBlock) doc.findBlock("s1/ex-num").orElseThrow();
        assertThat(ex.exerciceId()).isNotNull();
        assertThat(ex.prompt()).isEqualTo("Hypoténuse de 3 et 4 ?");

        // A draft or unknown course resolves to no document.
        assertThat(chapitreContentApi.findCoursVersionPubliee(UUID.randomUUID())).isEmpty();
    }

    private boolean containsKey(JsonNode node, String key) {
        if (node.isObject()) {
            if (node.has(key)) return true;
            for (JsonNode child : node) {
                if (containsKey(child, key)) return true;
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                if (containsKey(child, key)) return true;
            }
        }
        return false;
    }
}
