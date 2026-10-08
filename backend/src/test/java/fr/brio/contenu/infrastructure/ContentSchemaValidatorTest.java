package fr.brio.contenu.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.InvalidContentException;
import fr.brio.contenu.ContentViolation;
import java.util.List;
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
    void shouldAcceptObjectivesWithFreeTextItemsAndNoCompetencies() {
        // A teacher may state objectives as free-text sentences without attaching coded
        // competencies (the two facets are independent; ADR 0019 §2). The compétences picker
        // does not exist yet, so requiring codes here would block every teacher course.
        String block =
                """
                {
                  "id": "obj", "type": "objectives", "title": "Objectifs",
                  "items": ["Calculer une longueur avec **Pythagore**", "Reconnaître un triangle rectangle"]
                }
                """;
        assertThatCode(() -> validator.validate(chapterWith(block))).doesNotThrowAnyException();
    }

    @Test
    void shouldRejectObjectivesItemsThatAreNotStrings() {
        String block =
                """
                { "id": "obj", "type": "objectives", "items": [ { "text": "nope" } ] }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    // --- Located violations (#201) ----------------------------------------------------

    private List<ContentViolation> violationsOf(JsonNode document) {
        try {
            validator.validate(document);
        } catch (InvalidContentException e) {
            return e.violations();
        }
        throw new AssertionError("expected the document to be rejected");
    }

    @Test
    void shouldLocateAnEmptyFieldOnItsBlockOnly() {
        // The block union is a oneOf: every other branch also complains ("not a heading"…).
        // Only the prose branch explains what the author has to fix.
        String block = """
                { "id": "p1", "type": "prose", "text": "" }
                """;
        assertThat(violationsOf(chapterWith(block)))
                .containsExactly(new ContentViolation(ContentViolation.EMPTY, "s1", "p1", "text"));
    }

    @Test
    void shouldAcceptSolidsAndDashedLines() {
        String block =
                """
                { "id": "fig", "type": "figure", "alt": "Un pavé et un cylindre",
                  "spec": {
                    "points": [ { "name": "A", "x": 0, "y": 0 }, { "name": "B", "x": 1, "y": 0 } ],
                    "segments": [ { "from": "A", "to": "B", "style": "dashed" } ],
                    "solids": [
                      { "kind": "pave", "x": 0, "y": 0, "width": 4, "height": 3, "depth": 2,
                        "names": ["A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1"] },
                      { "kind": "prisme", "x": 6, "y": 0, "depth": 3, "angle": 30, "reduction": 0.6,
                        "base": [ { "x": 0, "y": 0 }, { "x": 3, "y": 0 }, { "x": 0, "y": 4 } ] },
                      { "kind": "cylindre", "x": 12, "y": 0, "radius": 1.5, "height": 4 }
                    ] } }
                """;
        assertThatCode(() -> validator.validate(chapterWith(block))).doesNotThrowAnyException();
    }

    @Test
    void shouldRejectTheDimensionsOfAnotherKindOfSolid() {
        String block =
                """
                { "id": "fig", "type": "figure", "alt": "Un cube",
                  "spec": { "solids": [ { "kind": "cube", "x": 0, "y": 0, "edge": 2, "width": 3 } ] } }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldRejectVertexNamesOnACylinder() {
        String block =
                """
                { "id": "fig", "type": "figure", "alt": "Un cylindre",
                  "spec": { "solids": [ { "kind": "cylindre", "x": 0, "y": 0, "radius": 1, "height": 2,
                                          "names": ["O"] } ] } }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldAcceptACubeAssemblageDescribedByItsPlanCote() {
        String block =
                """
                { "id": "fig", "type": "figure", "alt": "Un assemblage de 8 cubes",
                  "spec": { "solids": [ { "kind": "assemblage", "x": 0, "y": 0, "angle": 30,
                                          "heights": [ [2, 1, 0], [3, 1, 1] ] } ] } }
                """;
        assertThatCode(() -> validator.validate(chapterWith(block))).doesNotThrowAnyException();
    }

    @Test
    void shouldRejectVertexNamesOrAFractionalHeightOnAnAssemblage() {
        String named =
                """
                { "id": "fig", "type": "figure", "alt": "Un assemblage",
                  "spec": { "solids": [ { "kind": "assemblage", "x": 0, "y": 0, "heights": [ [1] ],
                                          "names": ["A"] } ] } }
                """;
        String fractional =
                """
                { "id": "fig", "type": "figure", "alt": "Un assemblage",
                  "spec": { "solids": [ { "kind": "assemblage", "x": 0, "y": 0, "heights": [ [1.5] ] } ] } }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(named)))
                .isInstanceOf(InvalidContentException.class);
        assertThatThrownBy(() -> validator.validate(chapterWith(fractional)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldRejectAPlanCoteOnAnotherKindOfSolid() {
        String block =
                """
                { "id": "fig", "type": "figure", "alt": "Un cube",
                  "spec": { "solids": [ { "kind": "cube", "x": 0, "y": 0, "edge": 2, "heights": [ [1] ] } ] } }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldAcceptABarAPieAndALineChart() {
        String bar =
                """
                { "id": "c1", "type": "chart", "kind": "bar", "title": "Sport préféré",
                  "xLabel": "Sport", "yLabel": "Effectif", "yMax": 10, "yStep": 2, "showValues": true,
                  "alt": "Football 8, Basket 5",
                  "series": [ { "label": "Effectif",
                                "data": [ { "label": "Football", "value": 8 }, { "label": "Basket", "value": 5 } ] } ] }
                """;
        String pie =
                """
                { "id": "c2", "type": "chart", "kind": "pie", "alt": "Football 8, Basket 5",
                  "series": [ { "label": "Effectif",
                                "data": [ { "label": "Football", "value": 8 }, { "label": "Basket", "value": 5 } ] } ] }
                """;
        String line =
                """
                { "id": "c3", "type": "chart", "kind": "line", "alt": "6 h : −2 °C, 12 h : 9 °C",
                  "series": [ { "label": "Température (°C)",
                                "data": [ { "label": "6 h", "value": -2 }, { "label": "12 h", "value": 9 } ] } ] }
                """;
        for (String block : List.of(bar, pie, line)) {
            assertThatCode(() -> validator.validate(chapterWith(block))).doesNotThrowAnyException();
        }
    }

    @Test
    void shouldRejectAxisFieldsOnAPieChart() {
        String block =
                """
                { "id": "c1", "type": "chart", "kind": "pie", "yLabel": "Effectif", "alt": "A 1, B 2",
                  "series": [ { "label": "Effectif",
                                "data": [ { "label": "A", "value": 1 }, { "label": "B", "value": 2 } ] } ] }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldRejectASecondSeries() {
        String block =
                """
                { "id": "c1", "type": "chart", "kind": "bar", "alt": "Deux séries",
                  "series": [
                    { "label": "Filles", "data": [ { "label": "A", "value": 1 }, { "label": "B", "value": 2 } ] },
                    { "label": "Garçons", "data": [ { "label": "A", "value": 3 }, { "label": "B", "value": 4 } ] } ] }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldRejectAChartWithoutAlt() {
        String block =
                """
                { "id": "c1", "type": "chart", "kind": "bar",
                  "series": [ { "label": "n", "data": [ { "label": "A", "value": 1 }, { "label": "B", "value": 2 } ] } ] }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldLocateAMissingExerciseFieldByItsName() {
        String block = """
                { "id": "ex1", "type": "exercise", "exerciseType": "numeric", "prompt": "Combien ?" }
                """;
        assertThat(violationsOf(chapterWith(block)))
                .containsExactly(new ContentViolation(ContentViolation.REQUIRED, "s1", "ex1", "answer"));
    }

    @Test
    void shouldLocateAnEmptyChoiceDownToItsIndex() {
        String block = """
                { "id": "qcm", "type": "exercise", "exerciseType": "multiple-choice", "prompt": "Q ?",
                  "choices": [ { "id": "a", "text": "", "correct": true },
                               { "id": "b", "text": "Non", "correct": false } ] }
                """;
        assertThat(violationsOf(chapterWith(block)))
                .containsExactly(new ContentViolation(ContentViolation.EMPTY, "s1", "qcm", "choices[0].text"));
    }

    @Test
    void shouldReportANonHttpsUrlAsAFormatProblem() {
        String block = """
                { "id": "ref", "type": "reference", "scope": "external", "title": "T", "url": "http://x.fr" }
                """;
        assertThat(violationsOf(chapterWith(block)))
                .containsExactly(new ContentViolation(ContentViolation.INVALID_FORMAT, "s1", "ref", "url"));
    }

    @Test
    void shouldLocateAnEmptySectionTitleOnTheSection() throws Exception {
        JsonNode document = objectMapper.readTree("""
                { "schemaVersion": 1, "id": "demo", "title": "Démo",
                  "sections": [ { "id": "s1", "title": "", "kind": "lesson",
                                  "blocks": [ { "id": "p1", "type": "prose", "text": "Texte" } ] } ] }
                """);
        assertThat(violationsOf(document))
                .containsExactly(new ContentViolation(ContentViolation.EMPTY, "s1", null, "title"));
    }
}
