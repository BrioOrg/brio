package fr.brio.contenu.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

/** What the tutor reads of a worked calculation (ADR 0042) and of a course calculator (ADR 0049). */
class ChapitreContentApiImplTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void shouldReadAChainOfEqualitiesWithTheEqualsSignsItImplies() throws Exception {
        var block = objectMapper.readTree(
                """
                { "id": "k", "type": "calcul", "mode": "egalites", "title": "Réduire",
                  "lines": [ { "latex": "A = 2x + 3 + 4x - 1" },
                             { "latex": "2x + 4x + 3 - 1", "note": "on regroupe" },
                             { "latex": "\\\\approx 6x" } ],
                  "conclusion": "Fini." }
                """);
        assertThat(ChapitreContentApiImpl.calculText(block))
                .isEqualTo("Réduire ; A = 2x + 3 + 4x - 1 ; = 2x + 4x + 3 - 1 (on regroupe) ; \\approx 6x ; Fini.");
    }

    @Test
    void shouldReadAnEquationLineByLine() throws Exception {
        var block = objectMapper.readTree(
                """
                { "id": "k", "type": "calcul", "mode": "equation",
                  "lines": [ { "latex": "4x = 28" }, { "latex": "x = \\\\frac{28}{4}", "op": "\\\\div 4" } ] }
                """);
        assertThat(ChapitreContentApiImpl.calculText(block)).isEqualTo("4x = 28 ; x = \\frac{28}{4}");
    }

    @Test
    void shouldGiveTheTutorTheInstructionAndTheExpressionsOfACalculator() throws Exception {
        var block = objectMapper.readTree(
                """
                { "id": "explorer-a", "type": "calculatrice",
                  "consigne": "Déplace le curseur $a$. Que se passe-t-il quand $a$ est négatif ?",
                  "expressions": ["f(x) = ax + 1", "a = 1"],
                  "fenetre": { "x": [-5, 5], "y": [-5, 5] } }
                """);
        assertThat(ChapitreContentApiImpl.calculatriceText(block))
                .isEqualTo("Déplace le curseur $a$. Que se passe-t-il quand $a$ est négatif ? ; f(x) = ax + 1 ; a = 1");
    }

    @Test
    void shouldGiveTheTutorTheExpressionsAloneWhenACalculatorHasNoInstruction() throws Exception {
        var block = objectMapper.readTree(
                """
                { "id": "c", "type": "calculatrice", "expressions": ["y = x^2"] }
                """);
        assertThat(ChapitreContentApiImpl.calculatriceText(block)).isEqualTo("y = x^2");
    }
}
