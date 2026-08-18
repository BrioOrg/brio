package fr.brio.exercices.domain;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import fr.brio.exercices.domain.ChoiceFeedback;
import fr.brio.exercices.domain.EvaluationResult;
import fr.brio.exercices.domain.Evaluator;
import fr.brio.exercices.domain.InvalidAnswerException;
import fr.brio.exercices.domain.MultipleChoiceEvaluator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MultipleChoiceEvaluatorTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private Evaluator evaluator;

    // evaluation JSON with choices: choice-a (wrong), choice-b (correct), choice-c (wrong)
    private static final String SINGLE_EVAL_JSON = """
            {
              "multiple": false,
              "choices": [
                {"id": "choice-a", "text": "A", "correct": false},
                {"id": "choice-b", "text": "B", "correct": true},
                {"id": "choice-c", "text": "C", "correct": false}
              ],
              "explanation": "B est correct."
            }
            """;

    // evaluation JSON with two correct choices
    private static final String MULTI_EVAL_JSON = """
            {
              "multiple": true,
              "choices": [
                {"id": "choice-a", "text": "A", "correct": true},
                {"id": "choice-b", "text": "B", "correct": false},
                {"id": "choice-c", "text": "C", "correct": true}
              ]
            }
            """;

    @BeforeEach
    void setUp() {
        evaluator = new MultipleChoiceEvaluator(objectMapper);
    }

    @Test
    void shouldReturnCorrectForExactSingleAnswer() throws Exception {
        ObjectNode answer = objectMapper.createObjectNode();
        ArrayNode ids = answer.putArray("choiceIds");
        ids.add("choice-b");

        EvaluationResult result = evaluator.evaluate(SINGLE_EVAL_JSON, answer);

        assertThat(result.correct()).isTrue();
        assertThat(result.score()).isEqualTo(1.0);
        assertThat(result.explanation()).isEqualTo("B est correct.");
        assertThat(result.choiceFeedback()).hasSize(3);
        assertThat(result.choiceFeedback())
                .contains(new ChoiceFeedback("choice-b", true))
                .contains(new ChoiceFeedback("choice-a", false));
    }

    @Test
    void shouldReturnIncorrectForWrongSingleAnswer() throws Exception {
        ObjectNode answer = objectMapper.createObjectNode();
        answer.putArray("choiceIds").add("choice-a");

        EvaluationResult result = evaluator.evaluate(SINGLE_EVAL_JSON, answer);

        assertThat(result.correct()).isFalse();
        assertThat(result.score()).isEqualTo(0.0);
    }

    @Test
    void shouldReturnCorrectForExactMultiSelectAnswer() throws Exception {
        ObjectNode answer = objectMapper.createObjectNode();
        ArrayNode ids = answer.putArray("choiceIds");
        ids.add("choice-a");
        ids.add("choice-c");

        EvaluationResult result = evaluator.evaluate(MULTI_EVAL_JSON, answer);

        assertThat(result.correct()).isTrue();
        assertThat(result.score()).isEqualTo(1.0);
    }

    @Test
    void shouldReturnIncorrectForPartialMultiSelect() throws Exception {
        ObjectNode answer = objectMapper.createObjectNode();
        answer.putArray("choiceIds").add("choice-a"); // missing choice-c

        EvaluationResult result = evaluator.evaluate(MULTI_EVAL_JSON, answer);

        assertThat(result.correct()).isFalse();
        assertThat(result.score()).isEqualTo(0.0);
    }

    @Test
    void shouldReturnIncorrectForExtraChoiceInMultiSelect() throws Exception {
        ObjectNode answer = objectMapper.createObjectNode();
        ArrayNode ids = answer.putArray("choiceIds");
        ids.add("choice-a");
        ids.add("choice-b"); // wrong
        ids.add("choice-c");

        EvaluationResult result = evaluator.evaluate(MULTI_EVAL_JSON, answer);

        assertThat(result.correct()).isFalse();
        assertThat(result.score()).isEqualTo(0.0);
    }

    @Test
    void shouldReturnIncorrectForUnknownChoiceId() throws Exception {
        ObjectNode answer = objectMapper.createObjectNode();
        answer.putArray("choiceIds").add("choice-does-not-exist");

        EvaluationResult result = evaluator.evaluate(SINGLE_EVAL_JSON, answer);

        assertThat(result.correct()).isFalse();
    }

    @Test
    void shouldReturnIncorrectForEmptyChoiceIds() throws Exception {
        ObjectNode answer = objectMapper.createObjectNode();
        answer.putArray("choiceIds"); // empty array

        EvaluationResult result = evaluator.evaluate(SINGLE_EVAL_JSON, answer);

        assertThat(result.correct()).isFalse();
    }

    @Test
    void shouldThrowInvalidAnswerExceptionWhenChoiceIdsIsMissing() throws Exception {
        ObjectNode answer = objectMapper.createObjectNode();
        answer.put("wrong_field", "choice-b");

        assertThatThrownBy(() -> evaluator.evaluate(SINGLE_EVAL_JSON, answer))
                .isInstanceOf(InvalidAnswerException.class)
                .hasMessageContaining("choiceIds");
    }

    @Test
    void shouldThrowInvalidAnswerExceptionWhenChoiceIdsIsNotArray() throws Exception {
        ObjectNode answer = objectMapper.createObjectNode();
        answer.put("choiceIds", "choice-b"); // string instead of array

        assertThatThrownBy(() -> evaluator.evaluate(SINGLE_EVAL_JSON, answer))
                .isInstanceOf(InvalidAnswerException.class);
    }

    @Test
    void exerciseTypeShouldBeMultipleChoice() {
        assertThat(evaluator.exerciseType()).isEqualTo("multiple-choice");
    }
}
