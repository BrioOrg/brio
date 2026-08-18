package fr.brio.exercices.domain;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NumericEvaluatorTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private Evaluator evaluator;

    private static final String EVAL_JSON = """
            {
              "answer": 10.0,
              "tolerance": 0.01,
              "explanation": "La réponse est 10."
            }
            """;

    private static final String ZERO_TOLERANCE_JSON = """
            {
              "answer": 5.0
            }
            """;

    @BeforeEach
    void setUp() {
        evaluator = new NumericEvaluator(objectMapper);
    }

    @Test
    void shouldReturnCorrectForExactAnswer() throws Exception {
        ObjectNode answer = objectMapper.createObjectNode();
        answer.put("value", 10.0);

        EvaluationResult result = evaluator.evaluate(EVAL_JSON, answer);

        assertThat(result.correct()).isTrue();
        assertThat(result.score()).isEqualTo(1.0);
        assertThat(result.expectedValue()).isEqualTo(10.0);
        assertThat(result.explanation()).isEqualTo("La réponse est 10.");
    }

    @Test
    void shouldReturnCorrectWhenWithinTolerance() throws Exception {
        ObjectNode answer = objectMapper.createObjectNode();
        answer.put("value", 10.005); // within 0.01

        EvaluationResult result = evaluator.evaluate(EVAL_JSON, answer);

        assertThat(result.correct()).isTrue();
    }

    @Test
    void shouldReturnCorrectAtExactToleranceBoundary() throws Exception {
        ObjectNode answer = objectMapper.createObjectNode();
        answer.put("value", 10.01); // exactly at boundary

        EvaluationResult result = evaluator.evaluate(EVAL_JSON, answer);

        assertThat(result.correct()).isTrue();
    }

    @Test
    void shouldReturnIncorrectWhenJustOutsideTolerance() throws Exception {
        ObjectNode answer = objectMapper.createObjectNode();
        answer.put("value", 10.02); // just outside 0.01

        EvaluationResult result = evaluator.evaluate(EVAL_JSON, answer);

        assertThat(result.correct()).isFalse();
        assertThat(result.score()).isEqualTo(0.0);
    }

    @Test
    void shouldReturnIncorrectForClearlyWrongAnswer() throws Exception {
        ObjectNode answer = objectMapper.createObjectNode();
        answer.put("value", 5.0);

        EvaluationResult result = evaluator.evaluate(EVAL_JSON, answer);

        assertThat(result.correct()).isFalse();
        assertThat(result.expectedValue()).isEqualTo(10.0);
    }

    @Test
    void shouldReturnCorrectForNegativeAnswerWithinTolerance() throws Exception {
        String evalJson = """
                {"answer": -3.0, "tolerance": 0.5}
                """;
        ObjectNode answer = objectMapper.createObjectNode();
        answer.put("value", -3.4);

        EvaluationResult result = evaluator.evaluate(evalJson, answer);

        assertThat(result.correct()).isTrue();
    }

    @Test
    void shouldRequireExactMatchWhenZeroTolerance() throws Exception {
        ObjectNode answerCorrect = objectMapper.createObjectNode();
        answerCorrect.put("value", 5.0);
        assertThat(evaluator.evaluate(ZERO_TOLERANCE_JSON, answerCorrect).correct()).isTrue();

        ObjectNode answerWrong = objectMapper.createObjectNode();
        answerWrong.put("value", 5.001);
        assertThat(evaluator.evaluate(ZERO_TOLERANCE_JSON, answerWrong).correct()).isFalse();
    }

    @Test
    void shouldThrowInvalidAnswerExceptionWhenValueFieldIsMissing() throws Exception {
        ObjectNode answer = objectMapper.createObjectNode();
        answer.put("wrong_field", 10.0);

        assertThatThrownBy(() -> evaluator.evaluate(EVAL_JSON, answer))
                .isInstanceOf(InvalidAnswerException.class)
                .hasMessageContaining("value");
    }

    @Test
    void shouldThrowInvalidAnswerExceptionWhenValueIsNotNumeric() throws Exception {
        ObjectNode answer = objectMapper.createObjectNode();
        answer.put("value", "dix"); // string instead of number

        assertThatThrownBy(() -> evaluator.evaluate(EVAL_JSON, answer))
                .isInstanceOf(InvalidAnswerException.class);
    }

    @Test
    void exerciseTypeShouldBeNumeric() {
        assertThat(evaluator.exerciseType()).isEqualTo("numeric");
    }
}
