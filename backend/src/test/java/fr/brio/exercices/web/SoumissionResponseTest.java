package fr.brio.exercices.web;

import fr.brio.exercices.SoumissionResult;
import fr.brio.exercices.domain.ChoiceFeedback;
import fr.brio.exercices.domain.EvaluationResult;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SoumissionResponseTest {

    @Test
    void givenWrongAnswerWhenMappedThenExpectedValueAndExplanationAreWithheld() {
        EvaluationResult evaluation = new EvaluationResult(
                false, 0.0, List.of(new ChoiceFeedback("b", false)), 10.0, "BC = 10 cm.");

        SoumissionResponse response = SoumissionResponse.from(new SoumissionResult(UUID.randomUUID(), evaluation));

        assertThat(response.correct()).isFalse();
        assertThat(response.expectedValue()).isNull();
        assertThat(response.explanation()).isNull();
        assertThat(response.choiceFeedback()).containsExactly(new ChoiceFeedback("b", false));
    }

    @Test
    void givenCorrectAnswerWhenMappedThenExpectedValueAndExplanationAreKept() {
        EvaluationResult evaluation = new EvaluationResult(true, 1.0, List.of(), 10.0, "BC = 10 cm.");

        SoumissionResponse response = SoumissionResponse.from(new SoumissionResult(UUID.randomUUID(), evaluation));

        assertThat(response.correct()).isTrue();
        assertThat(response.expectedValue()).isEqualTo(10.0);
        assertThat(response.explanation()).isEqualTo("BC = 10 cm.");
    }
}
