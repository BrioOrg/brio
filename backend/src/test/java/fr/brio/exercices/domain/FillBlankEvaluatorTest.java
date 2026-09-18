package fr.brio.exercices.domain;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FillBlankEvaluatorTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private Evaluator evaluator;

    private static final String SINGLE = """
            {"expected": ["c²"], "caseSensitive": false, "explanation": "a² + b² = c²."}
            """;

    private static final String MULTI = """
            {"expected": ["a²", "b²"], "caseSensitive": false}
            """;

    @BeforeEach
    void setUp() {
        evaluator = new FillBlankEvaluator(objectMapper);
    }

    @Test
    void exerciseTypeShouldBeFillBlank() {
        assertThat(evaluator.exerciseType()).isEqualTo("fill-blank");
    }

    @Test
    void shouldAcceptCorrectSingleBlank() {
        EvaluationResult result = evaluate(SINGLE, "c²");
        assertThat(result.correct()).isTrue();
        assertThat(result.score()).isEqualTo(1.0);
        assertThat(result.explanation()).isEqualTo("a² + b² = c².");
    }

    @Test
    void shouldRejectWrongSingleBlank() {
        EvaluationResult result = evaluate(SINGLE, "2c");
        assertThat(result.correct()).isFalse();
        assertThat(result.score()).isEqualTo(0.0);
    }

    @Test
    void shouldNormaliseAccentsAndCaseWhenNotCaseSensitive() {
        String eval = """
                {"expected": ["Café"], "caseSensitive": false}
                """;
        assertThat(evaluate(eval, "cafe").correct()).isTrue();
    }

    @Test
    void shouldAcceptAllBlanksCorrectInOrder() {
        EvaluationResult result = evaluate(MULTI, "a²", "b²");
        assertThat(result.correct()).isTrue();
        assertThat(result.score()).isEqualTo(1.0);
    }

    @Test
    void shouldGivePartialScoreButNotCorrectWhenOneBlankWrong() {
        EvaluationResult result = evaluate(MULTI, "a²", "zzz");
        assertThat(result.correct()).isFalse();
        assertThat(result.score()).isEqualTo(0.5);
    }

    @Test
    void shouldBeOrderSensitive() {
        // Right values, wrong slots → not correct.
        EvaluationResult result = evaluate(MULTI, "b²", "a²");
        assertThat(result.correct()).isFalse();
    }

    @Test
    void shouldThrowWhenBlanksMissing() {
        ObjectNode answer = objectMapper.createObjectNode();
        answer.put("response", "c²");
        assertThatThrownBy(() -> evaluator.evaluate(SINGLE, answer))
                .isInstanceOf(InvalidAnswerException.class)
                .hasMessageContaining("blanks");
    }

    @Test
    void shouldThrowWhenBlankCountMismatch() {
        assertThatThrownBy(() -> evaluate(MULTI, "a²"))
                .isInstanceOf(InvalidAnswerException.class)
                .hasMessageContaining("exactly 2");
    }

    @Test
    void shouldThrowWhenABlankIsEmpty() {
        assertThatThrownBy(() -> evaluate(SINGLE, "  "))
                .isInstanceOf(InvalidAnswerException.class);
    }

    // ---------- helpers ----------

    private EvaluationResult evaluate(String evalJson, String... blanks) {
        ObjectNode answer = objectMapper.createObjectNode();
        ArrayNode arr = answer.putArray("blanks");
        for (String b : blanks) {
            arr.add(b);
        }
        return evaluator.evaluate(evalJson, answer);
    }
}
