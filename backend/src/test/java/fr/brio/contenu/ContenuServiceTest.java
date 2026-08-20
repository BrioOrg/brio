package fr.brio.contenu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.domain.Chapitre;
import fr.brio.contenu.domain.Competence;
import fr.brio.contenu.domain.Exercice;
import fr.brio.contenu.infrastructure.ChapitreRepository;
import fr.brio.contenu.infrastructure.CompetenceRepository;
import fr.brio.contenu.infrastructure.ContentSchemaValidator;
import fr.brio.contenu.infrastructure.ExerciceRepository;
import fr.brio.contenu.infrastructure.MatiereRepository;
import fr.brio.contenu.infrastructure.NiveauRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ContenuServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ContentSchemaValidator validator = new ContentSchemaValidator();

    @Mock private ChapitreRepository chapitreRepository;
    @Mock private ExerciceRepository exerciceRepository;
    @Mock private CompetenceRepository competenceRepository;
    @Mock private NiveauRepository niveauRepository;
    @Mock private MatiereRepository matiereRepository;

    private ContenuService service;

    @BeforeEach
    void setUp() {
        lenient().when(chapitreRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(exerciceRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
        // By default every referenced competency code exists in the referential.
        lenient().when(competenceRepository.findAllById(any())).thenAnswer(inv ->
                StreamSupport.stream(((Iterable<String>) inv.getArgument(0)).spliterator(), false)
                        .map(code -> new Competence(code, "x", 4, List.of("3e"), "espace-et-geometrie", "BOEN"))
                        .toList());
        // By default the chapter's niveau and matiere are known.
        lenient().when(niveauRepository.existsById(any())).thenReturn(true);
        lenient().when(matiereRepository.existsById(any())).thenReturn(true);
        service = new ContenuService(
                chapitreRepository, exerciceRepository, competenceRepository,
                niveauRepository, matiereRepository, validator, objectMapper);
    }

    @Test
    void shouldIngestValidChapter() throws Exception {
        JsonNode doc = loadSeedDocument();
        service.ingestChapitre(doc);

        ArgumentCaptor<Chapitre> captor = ArgumentCaptor.forClass(Chapitre.class);
        verify(chapitreRepository).save(captor.capture());
        assertThat(captor.getValue().getId()).isEqualTo("theoreme-de-pythagore");
    }

    @Test
    void shouldExtractFiveExercicesFromSeedChapter() throws Exception {
        JsonNode doc = loadSeedDocument();
        service.ingestChapitre(doc);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Exercice>> captor = ArgumentCaptor.forClass(List.class);
        verify(exerciceRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(5);
    }

    @Test
    void shouldStripSensitiveEvalFieldsFromChapterContent() throws Exception {
        JsonNode doc = loadSeedDocument();
        service.ingestChapitre(doc);

        ArgumentCaptor<Chapitre> captor = ArgumentCaptor.forClass(Chapitre.class);
        verify(chapitreRepository).save(captor.capture());

        JsonNode stored = objectMapper.readTree(captor.getValue().getContent());
        assertSensitiveFieldsAbsent(stored);
    }

    @Test
    void shouldStripCorrectFlagFromChoicesButKeepDisplayFields() throws Exception {
        JsonNode doc = loadSeedDocument();
        service.ingestChapitre(doc);

        ArgumentCaptor<Chapitre> captor = ArgumentCaptor.forClass(Chapitre.class);
        verify(chapitreRepository).save(captor.capture());

        JsonNode stored = objectMapper.readTree(captor.getValue().getContent());
        JsonNode mcBlock = findExerciseBlock(stored, "multiple-choice");

        assertThat(mcBlock.has("choices")).isTrue();
        JsonNode choices = mcBlock.get("choices");
        assertThat(choices.isArray()).isTrue();
        assertThat(choices).hasSizeGreaterThan(0);
        choices.forEach(choice -> {
            assertThat(choice.has("correct")).as("'correct' must not appear in chapter choices").isFalse();
            assertThat(choice.has("text")).as("'text' must be present on every choice").isTrue();
            assertThat(choice.has("id")).as("'id' must be present on every choice").isTrue();
        });
    }

    @Test
    void shouldKeepMultipleInChapterContent() throws Exception {
        JsonNode doc = loadSeedDocument();
        service.ingestChapitre(doc);

        ArgumentCaptor<Chapitre> captor = ArgumentCaptor.forClass(Chapitre.class);
        verify(chapitreRepository).save(captor.capture());

        JsonNode stored = objectMapper.readTree(captor.getValue().getContent());
        JsonNode mcBlock = findExerciseBlock(stored, "multiple-choice");
        assertThat(mcBlock.has("multiple")).as("'multiple' must remain in chapter content for rendering").isTrue();
    }

    @Test
    void shouldIncludeExerciceIdInEveryExerciseBlock() throws Exception {
        JsonNode doc = loadSeedDocument();
        service.ingestChapitre(doc);

        ArgumentCaptor<Chapitre> captor = ArgumentCaptor.forClass(Chapitre.class);
        verify(chapitreRepository).save(captor.capture());

        JsonNode stored = objectMapper.readTree(captor.getValue().getContent());
        List<JsonNode> exerciseBlocks = allExerciseBlocks(stored);
        assertThat(exerciseBlocks).isNotEmpty();
        exerciseBlocks.forEach(block -> {
            assertThat(block.has("exerciceId")).as("exerciceId must be present on every exercise block").isTrue();
            String uuidStr = block.get("exerciceId").asText();
            assertThat(uuidStr).matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
        });
    }

    @Test
    void shouldPutChoicesWithCorrectFlagsInMultipleChoiceEvaluation() throws Exception {
        JsonNode doc = loadSeedDocument();
        service.ingestChapitre(doc);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Exercice>> captor = ArgumentCaptor.forClass(List.class);
        verify(exerciceRepository).saveAll(captor.capture());

        Exercice mc = captor.getValue().stream()
                .filter(e -> "multiple-choice".equals(e.getType()))
                .findFirst()
                .orElseThrow();

        JsonNode evaluation = objectMapper.readTree(mc.getEvaluation());
        assertThat(evaluation.has("choices")).isTrue();
        assertThat(evaluation.get("choices").get(0).has("correct")).isTrue();
    }

    @Test
    void shouldPutAnswerAndToleranceInNumericEvaluation() throws Exception {
        JsonNode doc = loadSeedDocument();
        service.ingestChapitre(doc);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Exercice>> captor = ArgumentCaptor.forClass(List.class);
        verify(exerciceRepository).saveAll(captor.capture());

        Exercice numeric = captor.getValue().stream()
                .filter(e -> "numeric".equals(e.getType()))
                .findFirst()
                .orElseThrow();

        JsonNode evaluation = objectMapper.readTree(numeric.getEvaluation());
        assertThat(evaluation.has("answer")).isTrue();
    }

    @Test
    void shouldRejectDocumentMissingRequiredFields() throws Exception {
        JsonNode invalid = objectMapper.readTree("""
                {"schemaVersion": 1, "id": "test-chapter", "title": "Test"}
                """);

        assertThatThrownBy(() -> service.ingestChapitre(invalid))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldRejectDocumentWithWrongSchemaVersion() throws Exception {
        JsonNode invalid = objectMapper.readTree("""
                {"schemaVersion": 99, "id": "bad", "title": "T",
                 "sections": [{"id": "s1", "title": "S", "kind": "lesson",
                   "blocks": [{"id": "b1", "type": "prose", "text": "Hi"}]}]}
                """);

        assertThatThrownBy(() -> service.ingestChapitre(invalid))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldRejectChapterReferencingUnknownCompetencyCode() throws Exception {
        // doReturn: re-stubbing with when(...) would invoke the setUp answer with a null argument
        doReturn(List.of()).when(competenceRepository).findAllById(any());

        JsonNode doc = loadSeedDocument();
        assertThatThrownBy(() -> service.ingestChapitre(doc))
                .isInstanceOf(InvalidContentException.class)
                .hasMessageContaining("c4.geo.pythagore.calculer");

        verify(chapitreRepository, never()).save(any());
        verify(exerciceRepository, never()).saveAll(any());
    }

    @Test
    void shouldRejectChapterWithUnknownNiveau() throws Exception {
        doReturn(false).when(niveauRepository).existsById(any());

        JsonNode doc = loadSeedDocument();
        assertThatThrownBy(() -> service.ingestChapitre(doc))
                .isInstanceOf(InvalidContentException.class)
                .hasMessageContaining("3e");

        verify(chapitreRepository, never()).save(any());
        verify(exerciceRepository, never()).saveAll(any());
    }

    @Test
    void shouldRejectChapterWithUnknownMatiere() throws Exception {
        doReturn(false).when(matiereRepository).existsById(any());

        JsonNode doc = loadSeedDocument();
        assertThatThrownBy(() -> service.ingestChapitre(doc))
                .isInstanceOf(InvalidContentException.class)
                .hasMessageContaining("mathematiques");

        verify(chapitreRepository, never()).save(any());
        verify(exerciceRepository, never()).saveAll(any());
    }

    private JsonNode loadSeedDocument() throws Exception {
        try (var is = getClass().getResourceAsStream(
                "/contenu/chapitres/3e/mathematiques/theoreme-de-pythagore.json")) {
            assertThat(is).as("Chapter file must be on test classpath").isNotNull();
            return objectMapper.readTree(is);
        }
    }

    private void assertSensitiveFieldsAbsent(JsonNode node) {
        ContenuService.SENSITIVE_EVAL_FIELDS.forEach(field ->
                assertThat(containsKey(node, field))
                        .as("Sensitive field '%s' must not appear in chapter content served to clients", field)
                        .isFalse()
        );
    }

    private JsonNode findExerciseBlock(JsonNode chapter, String exerciseType) {
        for (JsonNode section : chapter.get("sections")) {
            for (JsonNode block : section.get("blocks")) {
                if ("exercise".equals(block.path("type").asText())
                        && exerciseType.equals(block.path("exerciseType").asText())) {
                    return block;
                }
            }
        }
        throw new AssertionError("No exercise block of type " + exerciseType + " found");
    }

    private List<JsonNode> allExerciseBlocks(JsonNode chapter) {
        List<JsonNode> result = new ArrayList<>();
        for (JsonNode section : chapter.get("sections")) {
            for (JsonNode block : section.get("blocks")) {
                if ("exercise".equals(block.path("type").asText())) {
                    result.add(block);
                }
            }
        }
        return result;
    }

    private boolean containsKey(JsonNode node, String key) {
        if (node.isObject()) {
            if (node.has(key)) return true;
            for (var child : node) {
                if (containsKey(child, key)) return true;
            }
        } else if (node.isArray()) {
            for (var child : node) {
                if (containsKey(child, key)) return true;
            }
        }
        return false;
    }
}
