package fr.brio.exercices.domain;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ShortAnswerEvaluatorTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private Evaluator evaluator;

    private static final String EVAL_JSON = """
            {
              "acceptedAnswers": ["hypothénuse", "hypoténuse"],
              "caseSensitive": false,
              "explanation": "Le côté opposé à l'angle droit s'appelle l'hypothénuse."
            }
            """;

    private static final String CASE_SENSITIVE_EVAL_JSON = """
            {
              "acceptedAnswers": ["x"],
              "caseSensitive": true
            }
            """;

    @BeforeEach
    void setUp() {
        evaluator = new ShortAnswerEvaluator(objectMapper);
    }

    // ---------- correct matches ----------

    @Test
    void shouldMatchExactAnswer() {
        assertCorrect("hypothénuse");
    }

    @Test
    void shouldMatchAfterAccentRemoval() {
        assertCorrect("hypothenuse");
    }

    @Test
    void shouldMatchAfterLowercasing() {
        assertCorrect("HYPOTHÉNUSE");
    }

    @Test
    void shouldMatchAfterTrailingPeriod() {
        assertCorrect("hypothénuse.");
    }

    @Test
    void shouldMatchAfterMultipleTrailingPunctuation() {
        assertCorrect("hypothénuse!!");
    }

    @Test
    void shouldMatchAfterTrailingPunctuationMixedWithSpaces() {
        assertCorrect("hypothénuse .  ");
    }

    @Test
    void shouldMatchSecondAcceptedAnswer() {
        assertCorrect("hypoténuse");
    }

    @Test
    void shouldMatchLeadingAndTrailingWhitespace() {
        assertCorrect("  hypothénuse  ");
    }

    @Test
    void shouldMatchAfterCombinedNormalisations() {
        assertCorrect("  HYPOTENUSE!  ");
    }

    @Test
    void shouldReturnExplanationOnCorrectAnswer() {
        EvaluationResult result = evaluate(EVAL_JSON, "hypothénuse");
        assertThat(result.explanation()).isEqualTo("Le côté opposé à l'angle droit s'appelle l'hypothénuse.");
    }

    // ---------- non-matches ----------

    @ParameterizedTest(name = "''{0}'' should not match")
    @CsvSource({
            "cathéter",
            "côté adjacent",
            "le grand côté",
            "hypothénus",        // truncated
            "hyp",
    })
    void shouldNotMatchIncorrectAnswers(String text) {
        EvaluationResult result = evaluate(EVAL_JSON, text);
        assertThat(result.correct()).isFalse();
        assertThat(result.score()).isEqualTo(0.0);
    }

    // ---------- caseSensitive ----------

    @Test
    void shouldMatchExactCaseWhenCaseSensitive() {
        EvaluationResult result = evaluate(CASE_SENSITIVE_EVAL_JSON, "x");
        assertThat(result.correct()).isTrue();
    }

    @Test
    void shouldRejectWrongCaseWhenCaseSensitive() {
        EvaluationResult result = evaluate(CASE_SENSITIVE_EVAL_JSON, "X");
        assertThat(result.correct()).isFalse();
    }

    @Test
    void shouldStillRemoveAccentsWhenCaseSensitive() {
        // NFD normalisation always applies regardless of caseSensitive
        String evalJson = """
                {"acceptedAnswers": ["café"], "caseSensitive": true}
                """;
        EvaluationResult result = evaluate(evalJson, "cafe");
        assertThat(result.correct()).isTrue();
    }

    // ---------- multi-word answers ----------

    @Test
    void shouldMatchMultiWordAnswer() {
        String evalJson = """
                {"acceptedAnswers": ["les côtés de l'angle droit"], "caseSensitive": false}
                """;
        assertThat(evaluate(evalJson, "les cotés de l'angle droit.").correct()).isTrue();
        assertThat(evaluate(evalJson, "Les Côtés De L'Angle Droit").correct()).isTrue();
    }

    // ---------- normalise helper ----------

    @Test
    void shouldNormaliseAcceptedAnswersToo() {
        // An author who accidentally adds a trailing period in acceptedAnswers must still match
        String evalJson = """
                {"acceptedAnswers": ["hypothénuse."], "caseSensitive": false}
                """;
        assertThat(evaluate(evalJson, "hypothénuse").correct()).isTrue();
    }

    // ---------- empty / blank rejection ----------

    @Test
    void shouldThrowWhenTextFieldMissing() {
        ObjectNode answer = objectMapper.createObjectNode();
        answer.put("response", "hypothénuse");
        assertThatThrownBy(() -> evaluator.evaluate(EVAL_JSON, answer))
                .isInstanceOf(InvalidAnswerException.class)
                .hasMessageContaining("text");
    }

    @Test
    void shouldThrowWhenTextIsBlank() {
        ObjectNode answer = objectMapper.createObjectNode();
        answer.put("text", "   ");
        assertThatThrownBy(() -> evaluator.evaluate(EVAL_JSON, answer))
                .isInstanceOf(InvalidAnswerException.class)
                .hasMessageContaining("blank");
    }

    @Test
    void shouldThrowWhenTextIsEmpty() {
        ObjectNode answer = objectMapper.createObjectNode();
        answer.put("text", "");
        assertThatThrownBy(() -> evaluator.evaluate(EVAL_JSON, answer))
                .isInstanceOf(InvalidAnswerException.class);
    }

    @Test
    void exerciseTypeShouldBeShortAnswer() {
        assertThat(evaluator.exerciseType()).isEqualTo("short-answer");
    }

    // ---------- helpers ----------

    private void assertCorrect(String text) {
        EvaluationResult result = evaluate(EVAL_JSON, text);
        assertThat(result.correct()).as("expected '%s' to match", text).isTrue();
        assertThat(result.score()).isEqualTo(1.0);
    }

    private EvaluationResult evaluate(String evalJson, String text) {
        ObjectNode answer = objectMapper.createObjectNode();
        answer.put("text", text);
        return evaluator.evaluate(evalJson, answer);
    }
}
