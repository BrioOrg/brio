package fr.brio.contenu.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
                .hasMessageContaining("theoreme-de-pythagore");
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
                .hasMessageContaining("enonce-du-theoreme");
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
                .hasMessageContaining("c4.geo.pythagore.inexistante");
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
}
