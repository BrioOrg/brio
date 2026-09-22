package fr.brio.contenu.infrastructure;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.InvalidContentException;
import org.junit.jupiter.api.Test;

/**
 * Schema v2 (ADR 0019) — the additive blocks reference/table/steps/objectives validate,
 * and their required-field / discriminated-shape rules are enforced.
 */
class ContentSchemaValidatorTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ContentSchemaValidator validator = new ContentSchemaValidator();

    /** Wraps a single block as the sole block of a minimal, otherwise-valid chapter document. */
    private JsonNode chapterWith(String blockJson) {
        try {
            return objectMapper.readTree(
                    """
                    {
                      "schemaVersion": 1,
                      "id": "demo",
                      "title": "Démo",
                      "sections": [
                        { "id": "s1", "title": "Section", "kind": "lesson", "blocks": [ %s ] }
                      ]
                    }
                    """
                            .formatted(blockJson));
        } catch (Exception e) {
            throw new IllegalStateException("bad test fixture", e);
        }
    }

    @Test
    void shouldAcceptTheFourAdditiveBlocks() {
        String blocks =
                """
                {
                  "id": "obj", "type": "objectives", "title": "Objectifs",
                  "competencies": ["c4.geo.pythagore.calculer"]
                },
                {
                  "id": "met", "type": "steps", "title": "Méthode",
                  "steps": [ { "text": "Étape une" }, { "text": "Étape deux", "formula": "a^2+b^2=c^2" } ]
                },
                {
                  "id": "tab", "type": "table",
                  "headers": ["x", "y"], "rows": [ ["1", "2"], ["3", "4"] ], "caption": "Table"
                },
                {
                  "id": "ref", "type": "reference", "scope": "external",
                  "title": "Éduscol", "url": "https://eduscol.education.fr/"
                }
                """;
        assertThatCode(() -> validator.validate(chapterWith(blocks))).doesNotThrowAnyException();
    }

    @Test
    void shouldAcceptAnInternalReferenceWithATarget() {
        String block =
                """
                {
                  "id": "ref", "type": "reference", "scope": "internal", "title": "Pythagore",
                  "target": { "level": "3e", "subject": "mathematiques", "slug": "theoreme-de-pythagore" }
                }
                """;
        assertThatCode(() -> validator.validate(chapterWith(block))).doesNotThrowAnyException();
    }

    @Test
    void shouldRejectAnExternalReferenceWithoutUrl() {
        String block =
                """
                { "id": "ref", "type": "reference", "scope": "external", "title": "Sans URL" }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldRejectAnInternalReferenceWithoutTarget() {
        String block =
                """
                { "id": "ref", "type": "reference", "scope": "internal", "title": "Sans cible" }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldRejectAnExternalReferenceWithNonHttpsUrl() {
        String block =
                """
                {
                  "id": "ref", "type": "reference", "scope": "external",
                  "title": "HTTP", "url": "http://eduscol.education.fr/"
                }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldRejectAStepMissingItsText() {
        String block =
                """
                { "id": "met", "type": "steps", "steps": [ { "formula": "a^2" } ] }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldRejectAnUnknownPropertyOnATableBlock() {
        String block =
                """
                { "id": "tab", "type": "table", "rows": [ ["1"] ], "colour": "red" }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldRejectObjectivesWithoutCompetencies() {
        String block =
                """
                { "id": "obj", "type": "objectives", "title": "Objectifs" }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }
}
