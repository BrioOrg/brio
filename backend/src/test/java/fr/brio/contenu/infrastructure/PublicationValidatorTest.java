package fr.brio.contenu.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.ContentViolation;
import fr.brio.contenu.InvalidContentException;
import fr.brio.contenu.domain.Chapitre;
import fr.brio.contenu.domain.Competence;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class PublicationValidatorTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Mock private ChapitreRepository chapitreRepository;
    @Mock private CompetenceRepository competenceRepository;

    private PublicationValidator validator;

    @BeforeEach
    void setUp() {
        validator = new PublicationValidator(
                new ContentSchemaValidator(),
                new ContentReferentialValidator(competenceRepository),
                chapitreRepository,
                objectMapper);
    }

    private JsonNode doc(String blocksJson) throws Exception {
        return objectMapper.readTree("""
                {
                  "schemaVersion": 1,
                  "id": "mon-cours",
                  "title": "Mon cours",
                  "sections": [
                    { "id": "s1", "title": "Section 1", "kind": "lesson", "blocks": [ %s ] }
                  ]
                }
                """.formatted(blocksJson));
    }

    /** A published catalogue chapter with a single section 'enonce-du-theoreme'. */
    private void targetChapterExists() {
        Chapitre chapitre = new Chapitre(
                "theoreme-de-pythagore", "{\"sections\":[{\"id\":\"enonce-du-theoreme\"}]}",
                "3e", "mathematiques", 0, "published", "Pythagore", 0, "hash");
        lenient().doReturn(Optional.of(chapitre)).when(chapitreRepository)
                .findByNiveauCodeAndMatiereCodeAndIdAndStatut(
                        "3e", "mathematiques", "theoreme-de-pythagore", "published");
    }

    private static final String INTERNAL_REFERENCE = """
            { "id": "ref1", "type": "reference", "scope": "internal", "title": "Voir Pythagore",
              "target": { "level": "3e", "subject": "mathematiques",
                          "slug": "theoreme-de-pythagore", "anchor": "enonce-du-theoreme" } }
            """;

    @Test
    void shouldAcceptDocumentWithResolvableInternalReference() throws Exception {
        targetChapterExists();
        assertThatCode(() -> validator.validate(doc(INTERNAL_REFERENCE)))
                .doesNotThrowAnyException();
    }

    @Test
    void shouldBlockPublicationWhenInternalReferenceChapterMissing() throws Exception {
        lenient().doReturn(Optional.empty()).when(chapitreRepository)
                .findByNiveauCodeAndMatiereCodeAndIdAndStatut(any(), any(), any(), any());

        assertThatThrownBy(() -> validator.validate(doc(INTERNAL_REFERENCE)))
                .isInstanceOf(InvalidContentException.class)
                .hasMessageContaining("Broken internal reference")
                .hasMessageContaining("theoreme-de-pythagore")
                .extracting(e -> ((InvalidContentException) e).violations())
                .isEqualTo(List.of(new ContentViolation(
                        ContentViolation.REFERENCE_CHAPTER_NOT_FOUND, "s1", "ref1", "target")));
    }

    @Test
    void shouldBlockPublicationWhenAnchorIsNotASectionOfTarget() throws Exception {
        Chapitre chapitre = new Chapitre(
                "theoreme-de-pythagore", "{\"sections\":[{\"id\":\"autre-section\"}]}",
                "3e", "mathematiques", 0, "published", "Pythagore", 0, "hash");
        lenient().doReturn(Optional.of(chapitre)).when(chapitreRepository)
                .findByNiveauCodeAndMatiereCodeAndIdAndStatut(any(), any(), any(), any());

        assertThatThrownBy(() -> validator.validate(doc(INTERNAL_REFERENCE)))
                .isInstanceOf(InvalidContentException.class)
                .hasMessageContaining("anchor")
                .hasMessageContaining("enonce-du-theoreme")
                .extracting(e -> ((InvalidContentException) e).violations())
                .isEqualTo(List.of(new ContentViolation(
                        ContentViolation.REFERENCE_ANCHOR_NOT_FOUND, "s1", "ref1", "target.anchor")));
    }

    @Test
    void shouldBlockPublicationWhenFigureHasNoAltText() throws Exception {
        // Since #119 the backend consumes the canonical schema, which makes 'alt' required on
        // figure blocks. A figure with no textual equivalent (ADR 0013) is therefore rejected
        // at the schema layer, before the reference/referential checks run.
        String figureNoAlt = """
                { "id": "fig1", "type": "figure", "caption": "Un schéma" }
                """;
        assertThatThrownBy(() -> validator.validate(doc(figureNoAlt)))
                .isInstanceOf(InvalidContentException.class)
                .hasMessageContaining("alt");
    }

    @Test
    void shouldBlockPublicationWhenObjectiveReferencesUnknownCompetency() throws Exception {
        lenient().doReturn(List.of()).when(competenceRepository).findAllById(any());

        String objectives = """
                { "id": "obj1", "type": "objectives",
                  "competencies": ["c4.geo.pythagore.inexistante"] }
                """;
        assertThatThrownBy(() -> validator.validate(doc(objectives)))
                .isInstanceOf(InvalidContentException.class)
                .hasMessageContaining("c4.geo.pythagore.inexistante")
                .extracting(e -> ((InvalidContentException) e).violations())
                .isEqualTo(List.of(new ContentViolation(
                        ContentViolation.UNKNOWN_COMPETENCY, "s1", "obj1", "competencies")));
    }

    @Test
    void shouldAcceptObjectiveWithKnownCompetency() throws Exception {
        lenient().doReturn(List.of(new Competence(
                        "c4.geo.pythagore.calculer", "x", 4, List.of("3e"), "espace-et-geometrie", "BOEN")))
                .when(competenceRepository).findAllById(any());

        String objectives = """
                { "id": "obj1", "type": "objectives",
                  "competencies": ["c4.geo.pythagore.calculer"] }
                """;
        assertThatCode(() -> validator.validate(doc(objectives)))
                .doesNotThrowAnyException();
    }

    private static String fillBlank(String template, String bank, String expected) {
        return """
                { "id": "ex1", "type": "exercise", "exerciseType": "fill-blank",
                  "prompt": "Complète.", "template": "%s", "bank": %s, "expected": %s }
                """.formatted(template, bank, expected);
    }

    @Test
    void shouldAcceptConsistentFillBlank() throws Exception {
        String ex = fillBlank("Le {} est opposé à l'angle {}.", "[\"droit\", \"côté\", \"aigu\"]",
                "[\"côté\", \"droit\"]");
        assertThatCode(() -> validator.validate(doc(ex))).doesNotThrowAnyException();
    }

    @Test
    void shouldBlockFillBlankWhenBlankCountDiffersFromExpected() throws Exception {
        String ex = fillBlank("Le {} est opposé à l'angle {}.", "[\"droit\", \"côté\"]",
                "[\"côté\"]");
        assertThatThrownBy(() -> validator.validate(doc(ex)))
                .isInstanceOf(InvalidContentException.class)
                .hasMessageContaining("2 blank(s) but 1 expected")
                .extracting(e -> ((InvalidContentException) e).violations())
                .isEqualTo(List.of(new ContentViolation(
                        ContentViolation.BLANK_COUNT_MISMATCH, "s1", "ex1", "expected")));
    }

    @Test
    void shouldBlockFillBlankWhenExpectedAnswerIsNotInBank() throws Exception {
        String ex = fillBlank("Le {} est long.", "[\"côté\", \"angle\"]", "[\"hypoténuse\"]");
        assertThatThrownBy(() -> validator.validate(doc(ex)))
                .isInstanceOf(InvalidContentException.class)
                .hasMessageContaining("'hypoténuse' is not available in the bank")
                .extracting(e -> ((InvalidContentException) e).violations())
                .isEqualTo(List.of(new ContentViolation(
                        ContentViolation.ANSWER_NOT_IN_BANK, "s1", "ex1", "bank")));
    }

    @Test
    void shouldBlockFillBlankWhenBankHasTooFewCopiesOfARepeatedAnswer() throws Exception {
        // The widget uses each tile once: two blanks expecting "2" need two "2" tiles.
        String ex = fillBlank("{} + {} = 4", "[\"2\", \"3\"]", "[\"2\", \"2\"]");
        assertThatThrownBy(() -> validator.validate(doc(ex)))
                .isInstanceOf(InvalidContentException.class)
                .hasMessageContaining("'2' is not available in the bank");
    }

    @Test
    void shouldLocateAMissingAltTextOnTheFigure() throws Exception {
        String figure = """
                { "id": "fig1", "type": "figure", "alt": "", "spec": { "points": [] } }
                """;
        assertThatThrownBy(() -> validator.validate(doc(figure)))
                .isInstanceOf(InvalidContentException.class)
                .extracting(e -> ((InvalidContentException) e).violations())
                .isEqualTo(List.of(new ContentViolation(ContentViolation.EMPTY, "s1", "fig1", "alt")));
    }

    @Test
    void shouldBlockPublicationWhenAChartHasABlankAltText() throws Exception {
        // A blank alt passes the schema's minLength; a chart needs a real textual equivalent
        // like a figure (ADR 0030 §7).
        String chart = """
                { "id": "chart1", "type": "chart", "kind": "pie", "alt": "   ",
                  "series": [ { "label": "Effectif",
                                "data": [ { "label": "A", "value": 1 }, { "label": "B", "value": 2 } ] } ] }
                """;
        assertThatThrownBy(() -> validator.validate(doc(chart)))
                .isInstanceOf(InvalidContentException.class)
                .extracting(e -> ((InvalidContentException) e).violations())
                .isEqualTo(List.of(new ContentViolation(ContentViolation.MISSING_ALT, "s1", "chart1", "alt")));
    }
}
