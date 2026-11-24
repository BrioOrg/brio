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
    void shouldAcceptAListBlock() {
        String block =
                """
                { "id": "lst", "type": "list", "items": [ "Un ==point== clé", "Puis $x^2$" ] }
                """;
        assertThatCode(() -> validator.validate(chapterWith(block))).doesNotThrowAnyException();
    }

    @Test
    void shouldRejectAListBlockWithoutItems() {
        for (String block :
                List.of(
                        """
                        { "id": "lst", "type": "list" }
                        """,
                        """
                        { "id": "lst", "type": "list", "items": [] }
                        """)) {
            assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                    .isInstanceOf(InvalidContentException.class);
        }
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
    void shouldAcceptArcsByPointsOrByAngles() {
        String block =
                """
                { "id": "fig", "type": "figure", "alt": "Un demi-disque et un arc de construction",
                  "spec": {
                    "points": [ { "name": "O", "x": 0, "y": 0 }, { "name": "A", "x": -2, "y": 0 },
                                { "name": "B", "x": 2, "y": 0 } ],
                    "arcs": [
                      { "center": "O", "from": "B", "to": "A", "closed": "chord" },
                      { "center": "A", "radius": 3, "startAngle": -20, "endAngle": 20, "style": "dashed" }
                    ] } }
                """;
        assertThatCode(() -> validator.validate(chapterWith(block))).doesNotThrowAnyException();
    }

    @Test
    void shouldAcceptATonedFigure() {
        String block =
                """
                { "id": "fig", "type": "figure", "alt": "Triangle ABC rectangle en A",
                  "spec": {
                    "points": [ { "name": "A", "x": 0, "y": 0 }, { "name": "B", "x": 4, "y": 0 },
                                { "name": "C", "x": 0, "y": 3, "tone": 2 } ],
                    "segments": [ { "from": "A", "to": "B", "tone": 1 } ],
                    "polygons": [ { "vertices": ["A", "B", "C"], "tone": 3, "fill": "soft" } ],
                    "circles": [ { "center": "A", "radius": 1, "tone": 4 } ],
                    "arcs": [ { "center": "A", "radius": 2, "startAngle": 0, "endAngle": 90, "tone": 1 } ],
                    "angleMarks": [ { "vertex": "A", "from": "B", "to": "C", "right": true, "tone": 1 } ],
                    "labels": [ { "text": "a", "x": 2, "y": -0.5, "tone": 1 } ]
                  } }
                """;
        assertThatCode(() -> validator.validate(chapterWith(block))).doesNotThrowAnyException();
    }

    @Test
    void shouldRejectATonePastFour() {
        String block =
                """
                { "id": "fig", "type": "figure", "alt": "Un segment",
                  "spec": { "points": [ { "name": "A", "x": 0, "y": 0 }, { "name": "B", "x": 1, "y": 0 } ],
                            "segments": [ { "from": "A", "to": "B", "tone": 5 } ] } }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldRejectASoftFillWithoutATone() {
        String block =
                """
                { "id": "fig", "type": "figure", "alt": "Un triangle",
                  "spec": { "points": [ { "name": "A", "x": 0, "y": 0 }, { "name": "B", "x": 1, "y": 0 },
                                        { "name": "C", "x": 0, "y": 1 } ],
                            "polygons": [ { "vertices": ["A", "B", "C"], "fill": "soft" } ] } }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldRejectAnArcGivenBothByPointsAndByAngles() {
        String block =
                """
                { "id": "fig", "type": "figure", "alt": "Un arc",
                  "spec": { "points": [ { "name": "O", "x": 0, "y": 0 }, { "name": "A", "x": 1, "y": 0 } ],
                            "arcs": [ { "center": "O", "from": "A", "to": "A", "radius": 1,
                                        "startAngle": 0, "endAngle": 90 } ] } }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldRejectAnUnknownWayToCloseAnArc() {
        String block =
                """
                { "id": "fig", "type": "figure", "alt": "Un arc",
                  "spec": { "points": [ { "name": "O", "x": 0, "y": 0 } ],
                            "arcs": [ { "center": "O", "radius": 1, "startAngle": 0, "endAngle": 90,
                                        "closed": "triangle" } ] } }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldAcceptTransformationsVectorsLinesAndRays() {
        String block =
                """
                { "id": "fig", "type": "figure", "alt": "Un triangle et ses images",
                  "spec": {
                    "points": [ { "name": "A", "x": 0, "y": 0 }, { "name": "B", "x": 2, "y": 0 },
                                { "name": "C", "x": 1, "y": 2 }, { "name": "O", "x": 4, "y": 1 } ],
                    "polygons": [ { "vertices": ["A", "B", "C"] } ],
                    "lines": [ { "through": ["A", "B"], "label": "(d)", "style": "dashed" } ],
                    "rays": [ { "from": "O", "through": "C" } ],
                    "vectors": [ { "from": "A", "to": "B", "label": "\\\\vec{u}" } ],
                    "transformations": [
                      { "kind": "symetrie-axiale", "axis": ["A", "B"], "source": ["C"],
                        "show": { "construction": true } },
                      { "kind": "symetrie-centrale", "center": "O", "source": ["A", "B", "C"] },
                      { "kind": "translation", "from": "A", "to": "B", "source": ["C"], "suffix": "1" },
                      { "kind": "rotation", "center": "O", "angle": -90, "source": ["A"],
                        "show": { "construction": ["A"] } },
                      { "kind": "homothetie", "center": "O", "ratio": -0.5, "source": ["B"] }
                    ] } }
                """;
        assertThatCode(() -> validator.validate(chapterWith(block))).doesNotThrowAnyException();
    }

    @Test
    void shouldRejectATransformationWithTheParametersOfAnotherKind() {
        String block =
                """
                { "id": "fig", "type": "figure", "alt": "Une image",
                  "spec": { "points": [ { "name": "O", "x": 0, "y": 0 }, { "name": "A", "x": 1, "y": 0 } ],
                            "transformations": [ { "kind": "symetrie-centrale", "center": "O", "angle": 90,
                                                   "source": ["A"] } ] } }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldRejectARotationOfAWholeTurnOrATransformationWithoutSource() {
        String rotation =
                """
                { "id": "fig", "type": "figure", "alt": "Une image",
                  "spec": { "points": [ { "name": "O", "x": 0, "y": 0 }, { "name": "A", "x": 1, "y": 0 } ],
                            "transformations": [ { "kind": "rotation", "center": "O", "angle": 360,
                                                   "source": ["A"] } ] } }
                """;
        String sansSource =
                """
                { "id": "fig", "type": "figure", "alt": "Une image",
                  "spec": { "points": [ { "name": "O", "x": 0, "y": 0 } ],
                            "transformations": [ { "kind": "symetrie-centrale", "center": "O", "source": [] } ] } }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(rotation)))
                .isInstanceOf(InvalidContentException.class);
        assertThatThrownBy(() -> validator.validate(chapterWith(sansSource)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldRejectALineThroughASinglePoint() {
        String block =
                """
                { "id": "fig", "type": "figure", "alt": "Une droite",
                  "spec": { "points": [ { "name": "A", "x": 0, "y": 0 } ],
                            "lines": [ { "through": ["A"] } ] } }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
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
    void shouldAcceptFunctionsReadingsAndParametersInARepere() {
        String block =
                """
                { "id": "fig", "type": "figure", "alt": "La courbe de f",
                  "spec": { "axes": { "x": { "from": -4, "to": 4, "step": 1 },
                                      "y": { "from": -4, "to": 4, "step": 1 } },
                            "functions": [ { "name": "f", "expr": "a x² − 1", "domain": [-3, 3],
                                             "label": true, "style": "dashed" },
                                           { "name": "g", "expr": "1/x", "label": "Inverse" } ],
                            "readings": [ { "function": "f", "x": 1 }, { "function": "f", "y": 3 } ],
                            "parameters": [ { "name": "a", "min": -2, "max": 2, "step": 0.5, "value": 1 } ] } }
                """;
        assertThatCode(() -> validator.validate(chapterWith(block))).doesNotThrowAnyException();
    }

    @Test
    void shouldRejectAReadingGivenBothAnXAndAY() {
        String block =
                """
                { "id": "fig", "type": "figure", "alt": "La courbe de f",
                  "spec": { "axes": { "x": { "from": -4, "to": 4, "step": 1 },
                                      "y": { "from": -4, "to": 4, "step": 1 } },
                            "functions": [ { "name": "f", "expr": "x" } ],
                            "readings": [ { "function": "f", "x": 1, "y": 1 } ] } }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldRejectAFunctionWithoutExpressionOrWithALongName() {
        String withoutExpr =
                """
                { "id": "fig", "type": "figure", "alt": "La courbe de f",
                  "spec": { "functions": [ { "name": "f" } ] } }
                """;
        String longName =
                """
                { "id": "fig", "type": "figure", "alt": "La courbe de f",
                  "spec": { "functions": [ { "name": "prix", "expr": "2x" } ] } }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(withoutExpr)))
                .isInstanceOf(InvalidContentException.class);
        assertThatThrownBy(() -> validator.validate(chapterWith(longName)))
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
    void shouldAcceptACalculInEachMode() {
        String equation =
                """
                { "id": "k1", "type": "calcul", "mode": "equation", "title": "Résoudre $x + 13 = 41$",
                  "lines": [ { "latex": "x + 13 = 41" },
                             { "latex": "x = 41 - 13", "op": "-13", "focus": "- 13",
                               "note": "on soustrait 13 aux deux membres" },
                             { "latex": "x = 28" } ],
                  "conclusion": "La solution est $28$." }
                """;
        String egalites =
                """
                { "id": "k2", "type": "calcul", "mode": "egalites",
                  "lines": [ { "latex": "A = 2x + 3 + 4x - 1" }, { "latex": "6x + 2", "note": "on réduit" } ] }
                """;
        for (String block : List.of(equation, egalites)) {
            assertThatCode(() -> validator.validate(chapterWith(block))).doesNotThrowAnyException();
        }
    }

    @Test
    void shouldRejectAnOperationInAChainOfEqualities() {
        String block =
                """
                { "id": "k1", "type": "calcul", "mode": "egalites",
                  "lines": [ { "latex": "A = 1 + 1" }, { "latex": "2", "op": "+1" } ] }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldRejectACalculOfOneLine() {
        String block =
                """
                { "id": "k1", "type": "calcul", "mode": "equation", "lines": [ { "latex": "x = 1" } ] }
                """;
        assertThat(violationsOf(chapterWith(block)))
                .containsExactly(new ContentViolation(ContentViolation.EMPTY, "s1", "k1", "lines"));
    }

    @Test
    void shouldAcceptACalculatorWithAndWithoutItsOptionalFields() {
        String complet =
                """
                { "id": "explorer-a", "type": "calculatrice",
                  "consigne": "Déplace le curseur $a$. Que se passe-t-il quand $a$ est négatif ?",
                  "expressions": ["f(x) = ax + 1", "a = 1"],
                  "fenetre": { "x": [-5, 5], "y": [-5, 5] } }
                """;
        String minimal =
                """
                { "id": "c2", "type": "calculatrice", "expressions": ["y = x^2"] }
                """;
        for (String block : List.of(complet, minimal)) {
            assertThatCode(() -> validator.validate(chapterWith(block))).doesNotThrowAnyException();
        }
    }

    @Test
    void shouldRejectACalculatorWithoutExpressionOrWithAnUnknownField() {
        String sansExpression =
                """
                { "id": "c1", "type": "calculatrice", "expressions": [] }
                """;
        assertThat(violationsOf(chapterWith(sansExpression)))
                .containsExactly(new ContentViolation(ContentViolation.EMPTY, "s1", "c1", "expressions"));
        String fenetreIncomplete =
                """
                { "id": "c1", "type": "calculatrice", "expressions": ["y = x"],
                  "fenetre": { "x": [-5, 5, 6], "y": [-5, 5] } }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(fenetreIncomplete)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldAcceptATreeOfPossiblesAndAWeightedTree() {
        String possibles =
                """
                { "id": "t1", "type": "tree", "outcomes": true,
                  "alt": "Deux lancers d'une pièce : quatre issues",
                  "root": { "children": [
                    { "label": "P", "children": [ { "label": "P" }, { "label": "F" } ] },
                    { "label": "F", "children": [ { "label": "P" }, { "label": "F" } ] } ] } }
                """;
        String weighted =
                """
                { "id": "t2", "type": "tree", "orientation": "vertical", "outcomes": true, "products": true,
                  "highlightPath": [ "R", "B" ], "alt": "Deux tirages sans remise",
                  "root": { "children": [
                    { "label": "R", "probability": "3/5",
                      "children": [ { "label": "R", "probability": "2/4" }, { "label": "B", "probability": "2/4" } ] },
                    { "label": "$\\\\overline{R}$", "probability": "0,4",
                      "children": [ { "label": "R", "probability": "3/4", "outcome": "$\\\\overline{R} \\\\cap R$" },
                                    { "label": "B", "probability": "?" } ] } ] } }
                """;
        for (String block : List.of(possibles, weighted)) {
            assertThatCode(() -> validator.validate(chapterWith(block))).doesNotThrowAnyException();
        }
    }

    @Test
    void shouldRejectATreeFourLevelsDeep() {
        String block =
                """
                { "id": "t1", "type": "tree", "alt": "Trop profond",
                  "root": { "children": [ { "label": "A", "children": [ { "label": "B", "children": [
                    { "label": "C", "children": [ { "label": "D" } ] } ] } ] } ] } }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldRejectATreeWithoutAltOrWithAnUnknownOrientation() {
        String withoutAlt =
                """
                { "id": "t1", "type": "tree", "root": { "children": [ { "label": "A" } ] } }
                """;
        String diagonal =
                """
                { "id": "t1", "type": "tree", "orientation": "diagonal", "alt": "Arbre",
                  "root": { "children": [ { "label": "A" } ] } }
                """;
        for (String block : List.of(withoutAlt, diagonal)) {
            assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                    .isInstanceOf(InvalidContentException.class);
        }
    }

    @Test
    void shouldAcceptEachKindOfSolid() {
        List<String> blocks = List.of(
                """
                { "id": "s1", "type": "solid", "kind": "pave", "width": 4, "height": 3, "depth": 2,
                  "names": ["A", "B", "C", "D", "E", "F", "G", "H"],
                  "section": { "parallelTo": "front", "at": 1 }, "alt": "Un pavé" }
                """,
                """
                { "id": "s2", "type": "solid", "kind": "pyramide", "height": 4, "apex": { "x": 0, "y": 0 },
                  "base": [ { "x": 0, "y": 0 }, { "x": 4, "y": 0 }, { "x": 4, "y": 4 } ], "alt": "Une pyramide" }
                """,
                """
                { "id": "s3", "type": "solid", "kind": "cone", "radius": 2, "height": 4,
                  "names": ["O", "S"], "section": { "at": 1.5 }, "alt": "Un cône" }
                """,
                """
                { "id": "s4", "type": "solid", "kind": "boule", "radius": 3, "equator": true,
                  "parallels": [45], "meridians": [0, 60],
                  "points": [ { "name": "M", "latitude": 45, "longitude": 60 } ],
                  "section": { "at": 1 }, "alt": "Une sphère" }
                """);
        for (String block : blocks) {
            assertThatCode(() -> validator.validate(chapterWith(block))).doesNotThrowAnyException();
        }
    }

    @Test
    void shouldRejectASolidWithoutItsDimensions() {
        String block = """
                { "id": "s1", "type": "solid", "kind": "cylindre", "radius": 2, "alt": "Un cylindre" }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldRejectSphereFieldsOnAnotherSolid() {
        String block = """
                { "id": "s1", "type": "solid", "kind": "cube", "edge": 2, "equator": true, "alt": "Un cube" }
                """;
        assertThatThrownBy(() -> validator.validate(chapterWith(block)))
                .isInstanceOf(InvalidContentException.class);
    }

    @Test
    void shouldRejectASolidWithoutAlt() {
        String block = """
                { "id": "s1", "type": "solid", "kind": "cube", "edge": 2 }
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
