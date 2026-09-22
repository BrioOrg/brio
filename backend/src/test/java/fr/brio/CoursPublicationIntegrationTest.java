package fr.brio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.ContenuService;
import fr.brio.contenu.CoursEditionService;
import fr.brio.contenu.api.CreerBrouillonCommand;
import fr.brio.contenu.api.ModifierBrouillonCommand;
import fr.brio.contenu.api.PublicationResult;
import fr.brio.contenu.domain.CoursVersion;
import fr.brio.contenu.domain.CoursVersionId;
import fr.brio.contenu.domain.Exercice;
import fr.brio.contenu.infrastructure.ChapitreIngestor;
import fr.brio.contenu.infrastructure.CoursRepository;
import fr.brio.contenu.infrastructure.CoursVersionRepository;
import fr.brio.contenu.infrastructure.ExerciceRepository;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class CoursPublicationIntegrationTest {

    @Autowired CoursEditionService coursEditionService;
    @Autowired CoursRepository coursRepository;
    @Autowired CoursVersionRepository coursVersionRepository;
    @Autowired ExerciceRepository exerciceRepository;
    @Autowired ChapitreIngestor chapitreIngestor;
    @Autowired ObjectMapper objectMapper;

    @BeforeEach
    void seedCatalogueChapter() throws Exception {
        // The teacher course carries an internal reference to this published catalogue chapter.
        try (var is = getClass().getResourceAsStream(
                "/contenu/chapitres/3e/mathematiques/theoreme-de-pythagore.json")) {
            JsonNode doc = objectMapper.readTree(is);
            chapitreIngestor.ingestDocument(doc, "3e", "mathematiques", 0);
        }
    }

    private JsonNode draftContent(String titre) throws Exception {
        return objectMapper.readTree("""
                {
                  "schemaVersion": 1,
                  "id": "cours-enseignant",
                  "title": "%s",
                  "sections": [
                    { "id": "s1", "title": "Leçon", "kind": "lesson", "blocks": [
                      { "id": "p1", "type": "prose", "text": "Bonjour" },
                      { "id": "img1", "type": "image", "asset": "a.svg", "alt": "un schéma" },
                      { "id": "ref1", "type": "reference", "scope": "internal", "title": "Voir Pythagore",
                        "target": { "level": "3e", "subject": "mathematiques",
                                    "slug": "theoreme-de-pythagore", "anchor": "enonce-du-theoreme" } },
                      { "id": "ex-num", "type": "exercise", "exerciseType": "numeric",
                        "prompt": "Hypoténuse de 3 et 4 ?",
                        "competencies": ["c4.geo.pythagore.calculer"],
                        "answer": 5, "tolerance": 0.01 },
                      { "id": "ex-qcm", "type": "exercise", "exerciseType": "multiple-choice",
                        "prompt": "Quel côté est l'hypoténuse ?",
                        "competencies": ["c4.geo.pythagore.calculer"], "multiple": false,
                        "choices": [
                          { "id": "a", "text": "Le côté [RS]", "correct": false },
                          { "id": "b", "text": "Le côté [RT]", "correct": true }
                        ] }
                    ] }
                  ]
                }
                """.formatted(titre));
    }

    private UUID createPublishedCourse() throws Exception {
        UUID coursId = coursEditionService.creerBrouillon(new CreerBrouillonCommand(
                UUID.randomUUID(), UUID.randomUUID(), "Mon cours",
                "3e", "mathematiques", draftContent("Mon cours")));
        coursEditionService.definirPortees(coursId, Set.of(UUID.randomUUID()));
        coursEditionService.publier(coursId);
        return coursId;
    }

    @Test
    void shouldFreezeVersionStrippedOfCorrectionFields() throws Exception {
        UUID coursId = coursEditionService.creerBrouillon(new CreerBrouillonCommand(
                UUID.randomUUID(), UUID.randomUUID(), "Mon cours",
                "3e", "mathematiques", draftContent("Mon cours")));

        PublicationResult result = coursEditionService.publier(coursId);
        assertThat(result.version()).isEqualTo(1);

        CoursVersion version = coursVersionRepository
                .findById(new CoursVersionId(coursId, 1)).orElseThrow();
        JsonNode stored = objectMapper.readTree(version.getContent());

        // No correction field reaches the stored published content.
        ContenuService.SENSITIVE_EVAL_FIELDS.forEach(field ->
                assertThat(containsKey(stored, field))
                        .as("Correction field '%s' must never appear in published content", field)
                        .isFalse());
        // The per-choice correct flag is stripped, display fields kept.
        assertThat(containsKey(stored, "correct")).isFalse();
        assertThat(containsKey(stored, "exerciceId")).isTrue();

        // Correction data lives in the exercise rows instead, keyed on this course version.
        List<Exercice> exercices = exerciceRepository.findByCoursId(coursId);
        assertThat(exercices).hasSize(2);
        assertThat(exercices).allSatisfy(ex -> {
            assertThat(ex.getChapitreId()).isNull();
            assertThat(ex.getCoursVersion()).isEqualTo(1);
        });
        Exercice numeric = exercices.stream()
                .filter(ex -> "ex-num".equals(ex.getSlug())).findFirst().orElseThrow();
        assertThat(numeric.getEvaluation()).contains("answer");
    }

    @Test
    void shouldMintNewVersionAndLeaveEarlierVersionUnchanged() throws Exception {
        UUID coursId = coursEditionService.creerBrouillon(new CreerBrouillonCommand(
                UUID.randomUUID(), UUID.randomUUID(), "V1",
                "3e", "mathematiques", draftContent("V1")));
        coursEditionService.publier(coursId);

        String v1ContentBefore = coursVersionRepository
                .findById(new CoursVersionId(coursId, 1)).orElseThrow().getContent();
        Set<UUID> v1ExerciceIds = idsOf(exerciceRepository.findByCoursId(coursId));

        // Edit the draft and publish again.
        coursEditionService.enregistrerBrouillon(coursId,
                new ModifierBrouillonCommand("V2", draftContent("V2")));
        PublicationResult second = coursEditionService.publier(coursId);
        assertThat(second.version()).isEqualTo(2);

        // The v1 snapshot is immutable — untouched by the v2 publish.
        String v1ContentAfter = coursVersionRepository
                .findById(new CoursVersionId(coursId, 1)).orElseThrow().getContent();
        assertThat(v1ContentAfter).isEqualTo(v1ContentBefore);
        assertThat(coursRepository.findById(coursId).orElseThrow().getVersionPubliee()).isEqualTo(2);

        // Immutable versions mint fresh exercise UUIDs (unlike catalogue re-ingestion).
        Set<UUID> v2ExerciceIds = idsOf(exerciceRepository.findByCoursId(coursId).stream()
                .filter(ex -> ex.getCoursVersion() == 2).collect(Collectors.toList()));
        assertThat(v2ExerciceIds).doesNotContainAnyElementsOf(v1ExerciceIds);
    }

    @Test
    void shouldSurviveFullCatalogueReIngestion() throws Exception {
        UUID coursId = createPublishedCourse();
        Set<UUID> teacherExerciceIds = idsOf(exerciceRepository.findByCoursId(coursId));
        assertThat(teacherExerciceIds).isNotEmpty();

        // A blank-DB-style full re-ingestion of the catalogue (ADR 0019 §8.6).
        Path contentDir = Paths.get(getClass().getResource("/contenu").toURI());
        chapitreIngestor.ingestAll(contentDir);

        // The teacher course, its version and its exercises are all still there.
        assertThat(coursRepository.findById(coursId)).isPresent();
        assertThat(coursVersionRepository.findById(new CoursVersionId(coursId, 1))).isPresent();
        assertThat(idsOf(exerciceRepository.findByCoursId(coursId)))
                .containsExactlyInAnyOrderElementsOf(teacherExerciceIds);
    }

    private static Set<UUID> idsOf(List<Exercice> exercices) {
        return exercices.stream().map(Exercice::getId).collect(Collectors.toSet());
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
