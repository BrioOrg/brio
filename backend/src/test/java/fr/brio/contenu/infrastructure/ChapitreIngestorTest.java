package fr.brio.contenu.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.ContenuService;
import fr.brio.contenu.InvalidContentException;
import fr.brio.contenu.domain.Chapitre;
import fr.brio.contenu.domain.Competence;
import fr.brio.contenu.domain.Exercice;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
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
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ChapitreIngestorTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ContentSchemaValidator validator = new ContentSchemaValidator();

    @Mock private ChapitreRepository chapitreRepository;
    @Mock private ExerciceRepository exerciceRepository;
    @Mock private CompetenceRepository competenceRepository;
    @Mock private NiveauRepository niveauRepository;
    @Mock private MatiereRepository matiereRepository;

    private ChapitreIngestionTx tx;

    @BeforeEach
    void setUp() {
        lenient().when(chapitreRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(chapitreRepository.findById(any())).thenReturn(Optional.empty());
        lenient().when(exerciceRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(exerciceRepository.findByChapitreId(any())).thenReturn(List.of());
        lenient().when(competenceRepository.findAllById(any())).thenAnswer(inv ->
                StreamSupport.stream(((Iterable<String>) inv.getArgument(0)).spliterator(), false)
                        .map(code -> activeCompetence(code))
                        .toList());
        lenient().when(niveauRepository.existsById(any())).thenReturn(true);
        lenient().when(matiereRepository.existsById(any())).thenReturn(true);
        tx = new ChapitreIngestionTx(
                chapitreRepository, exerciceRepository, competenceRepository,
                niveauRepository, matiereRepository, validator, objectMapper);
    }

    @Test
    void shouldCreateChapterOnFirstIngest() throws Exception {
        JsonNode doc = loadFixture();
        tx.ingestDocument(doc, "3e", "mathematiques", 0);

        ArgumentCaptor<Chapitre> captor = ArgumentCaptor.forClass(Chapitre.class);
        verify(chapitreRepository).save(captor.capture());
        assertThat(captor.getValue().getId()).isEqualTo("theoreme-de-pythagore");
        assertThat(captor.getValue().getContentHash()).isNotBlank();
    }

    @Test
    void shouldReturnCreatedStatusOnFirstIngest() throws Exception {
        JsonNode doc = loadFixture();
        ChapterResult result = tx.ingestDocument(doc, "3e", "mathematiques", 0);
        assertThat(result.status()).isEqualTo(ChapterResult.Status.CREATED);
    }

    @Test
    void shouldSkipChapterWhenHashUnchanged() throws Exception {
        JsonNode doc = loadFixture();
        String hash = tx.computeHash(doc);
        Chapitre existing = new Chapitre("theoreme-de-pythagore", "{}", "3e", "mathematiques", 0, "published", "T", 0, hash);
        doReturn(Optional.of(existing)).when(chapitreRepository).findById("theoreme-de-pythagore");

        ChapterResult result = tx.ingestDocument(doc, "3e", "mathematiques", 0);

        assertThat(result.status()).isEqualTo(ChapterResult.Status.SKIPPED);
        verify(chapitreRepository, never()).save(any());
        verify(exerciceRepository, never()).saveAll(any());
    }

    @Test
    void shouldUpdateChapterWhenHashDiffers() throws Exception {
        JsonNode doc = loadFixture();
        Chapitre existing = new Chapitre("theoreme-de-pythagore", "{}", "3e", "mathematiques", 0, "published", "T", 0, "stale-hash");
        doReturn(Optional.of(existing)).when(chapitreRepository).findById("theoreme-de-pythagore");

        ChapterResult result = tx.ingestDocument(doc, "3e", "mathematiques", 0);

        assertThat(result.status()).isEqualTo(ChapterResult.Status.UPDATED);
        verify(chapitreRepository).save(existing);
    }

    @Test
    void shouldExtractFiveExercicesFromFixture() throws Exception {
        JsonNode doc = loadFixture();
        tx.ingestDocument(doc, "3e", "mathematiques", 0);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Exercice>> captor = ArgumentCaptor.forClass(List.class);
        verify(exerciceRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(5);
    }

    @Test
    void shouldPreserveExerciseUuidsOnUpdate() throws Exception {
        JsonNode doc = loadFixture();
        UUID existingUuid = UUID.randomUUID();
        Exercice existingEx = new Exercice(existingUuid, "theoreme-de-pythagore",
                "ex-reconnaitre-hypotenuse", "multiple-choice", "{}", List.of());

        Chapitre existingChapter = new Chapitre("theoreme-de-pythagore", "{}", "3e", "mathematiques", 0, "published", "T", 0, "stale");
        doReturn(Optional.of(existingChapter)).when(chapitreRepository).findById("theoreme-de-pythagore");
        doReturn(List.of(existingEx)).when(exerciceRepository).findByChapitreId("theoreme-de-pythagore");

        tx.ingestDocument(doc, "3e", "mathematiques", 0);

        // The existing UUID must appear in the stored chapter content
        ArgumentCaptor<Chapitre> chapitreCaptor = ArgumentCaptor.forClass(Chapitre.class);
        verify(chapitreRepository).save(chapitreCaptor.capture());
        assertThat(chapitreCaptor.getValue().getContent()).contains(existingUuid.toString());
    }

    @Test
    void shouldRetireExercisesRemovedFromFile() throws Exception {
        JsonNode doc = loadFixture();
        Exercice orphan = new Exercice(UUID.randomUUID(), "theoreme-de-pythagore",
                "old-exercise-slug", "numeric", "{}", List.of());

        Chapitre existingChapter = new Chapitre("theoreme-de-pythagore", "{}", "3e", "mathematiques", 0, "published", "T", 0, "stale");
        doReturn(Optional.of(existingChapter)).when(chapitreRepository).findById("theoreme-de-pythagore");
        doReturn(List.of(orphan)).when(exerciceRepository).findByChapitreId("theoreme-de-pythagore");

        tx.ingestDocument(doc, "3e", "mathematiques", 0);

        ArgumentCaptor<Exercice> captor = ArgumentCaptor.forClass(Exercice.class);
        verify(exerciceRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
        Exercice retiredEx = captor.getAllValues().stream()
                .filter(e -> "old-exercise-slug".equals(e.getSlug()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Orphan exercise not saved after retire"));
        assertThat(retiredEx.getRetiredAt()).isNotNull();
    }

    @Test
    void shouldStripSensitiveEvalFieldsFromChapterContent() throws Exception {
        JsonNode doc = loadFixture();
        tx.ingestDocument(doc, "3e", "mathematiques", 0);

        ArgumentCaptor<Chapitre> captor = ArgumentCaptor.forClass(Chapitre.class);
        verify(chapitreRepository).save(captor.capture());

        JsonNode stored = objectMapper.readTree(captor.getValue().getContent());
        ContenuService.SENSITIVE_EVAL_FIELDS.forEach(field ->
                assertThat(containsKey(stored, field))
                        .as("Sensitive field '%s' must not appear in chapter content", field)
                        .isFalse()
        );
    }

    @Test
    void shouldStripCorrectFlagFromChoicesButPreserveDisplayFields() throws Exception {
        JsonNode doc = loadFixture();
        tx.ingestDocument(doc, "3e", "mathematiques", 0);

        ArgumentCaptor<Chapitre> captor = ArgumentCaptor.forClass(Chapitre.class);
        verify(chapitreRepository).save(captor.capture());

        JsonNode stored = objectMapper.readTree(captor.getValue().getContent());
        JsonNode choices = findExerciseBlock(stored, "multiple-choice").get("choices");
        assertThat(choices.isArray()).isTrue();
        choices.forEach(choice -> {
            assertThat(choice.has("correct")).as("'correct' must not appear").isFalse();
            assertThat(choice.has("text")).as("'text' must be present").isTrue();
            assertThat(choice.has("id")).as("'id' must be present").isTrue();
        });
    }

    @Test
    void shouldIncludeExerciceIdInEveryExerciseBlock() throws Exception {
        JsonNode doc = loadFixture();
        tx.ingestDocument(doc, "3e", "mathematiques", 0);

        ArgumentCaptor<Chapitre> captor = ArgumentCaptor.forClass(Chapitre.class);
        verify(chapitreRepository).save(captor.capture());

        JsonNode stored = objectMapper.readTree(captor.getValue().getContent());
        allExerciseBlocks(stored).forEach(block -> {
            assertThat(block.has("exerciceId")).isTrue();
            assertThat(block.get("exerciceId").asText())
                    .matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
        });
    }

    @Test
    void shouldApplyPublishedStatusWhenAbsentFromFile() throws Exception {
        JsonNode doc = objectMapper.readTree(loadFixture().toString()); // no "status" field in fixture
        tx.ingestDocument(doc, "3e", "mathematiques", 0);

        ArgumentCaptor<Chapitre> captor = ArgumentCaptor.forClass(Chapitre.class);
        verify(chapitreRepository).save(captor.capture());
        assertThat(captor.getValue().getStatut()).isEqualTo("published");
    }

    @Test
    void shouldRejectChapterReferencingUnknownCompetencyCode() throws Exception {
        doReturn(List.of()).when(competenceRepository).findAllById(any());

        assertThatThrownBy(() -> tx.ingestDocument(loadFixture(), "3e", "mathematiques", 0))
                .isInstanceOf(InvalidContentException.class)
                .hasMessageContaining("c4.geo.pythagore.calculer");

        verify(chapitreRepository, never()).save(any());
        verify(exerciceRepository, never()).saveAll(any());
    }

    @Test
    void shouldRejectChapterReferencingDeprecatedCompetencyCode() throws Exception {
        // Return active codes for everything except c4.geo.pythagore.calculer, which is deprecated.
        doAnswer(inv -> {
            Iterable<String> ids = inv.getArgument(0);
            return StreamSupport.stream(ids.spliterator(), false)
                    .map(code -> {
                        Competence c = activeCompetence(code);
                        if ("c4.geo.pythagore.calculer".equals(code)) {
                            c.update(c.getIntitule(), c.getCycle(), c.getNiveaux(),
                                    c.getDomaine(), c.getReferenceOfficielle(),
                                    "Arrêté du 10 avril 2025, BO n°16", List.of());
                        }
                        return c;
                    })
                    .toList();
        }).when(competenceRepository).findAllById(any());

        assertThatThrownBy(() -> tx.ingestDocument(loadFixture(), "3e", "mathematiques", 0))
                .isInstanceOf(InvalidContentException.class)
                .hasMessageContaining("c4.geo.pythagore.calculer")
                .hasMessageContaining("Deprecated");

        verify(chapitreRepository, never()).save(any());
        verify(exerciceRepository, never()).saveAll(any());
    }

    @Test
    void shouldRejectChapterWithUnknownNiveau() throws Exception {
        doReturn(false).when(niveauRepository).existsById(any());

        assertThatThrownBy(() -> tx.ingestDocument(loadFixture(), "3e", "mathematiques", 0))
                .isInstanceOf(InvalidContentException.class)
                .hasMessageContaining("3e");

        verify(chapitreRepository, never()).save(any());
    }

    @Test
    void shouldRejectChapterWithUnknownMatiere() throws Exception {
        doReturn(false).when(matiereRepository).existsById(any());

        assertThatThrownBy(() -> tx.ingestDocument(loadFixture(), "3e", "mathematiques", 0))
                .isInstanceOf(InvalidContentException.class)
                .hasMessageContaining("mathematiques");

        verify(chapitreRepository, never()).save(any());
    }

    @Test
    void shouldRejectDocumentMissingRequiredFields() throws Exception {
        JsonNode invalid = objectMapper.readTree("""
                {"schemaVersion": 1, "id": "test-chapter", "title": "Test"}
                """);

        assertThatThrownBy(() -> tx.ingestDocument(invalid, "3e", "mathematiques", 0))
                .isInstanceOf(InvalidContentException.class);
    }

    private static Competence activeCompetence(String code) {
        return new Competence(code, "x", 4, List.of("3e"), "espace-et-geometrie", "BOEN");
    }

    private JsonNode loadFixture() throws Exception {
        try (var is = getClass().getResourceAsStream(
                "/contenu/chapitres/3e/mathematiques/theoreme-de-pythagore.json")) {
            assertThat(is).as("Chapter fixture must be on test classpath").isNotNull();
            return objectMapper.readTree(is);
        }
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
        throw new AssertionError("No exercise block of type " + exerciseType);
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
