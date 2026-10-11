package fr.brio.exercices.web;

import fr.brio.exercices.SoumissionResult;
import fr.brio.exercices.domain.ChoiceFeedback;
import fr.brio.exercices.domain.EvaluationResult;
import java.util.List;
import java.util.UUID;

record SoumissionResponse(
        UUID soumissionId,
        boolean correct,
        double score,
        List<ChoiceFeedback> choiceFeedback,
        Double expectedValue,
        String explanation
) {
    /**
     * A wrong answer never reveals the answer (T0, #253): the expected value is the answer
     * itself, and author explanations often state it — both are withheld until it is correct.
     */
    static SoumissionResponse from(SoumissionResult result) {
        EvaluationResult evaluation = result.evaluation();
        boolean correct = evaluation.correct();
        return new SoumissionResponse(
                result.soumissionId(),
                correct,
                evaluation.score(),
                evaluation.choiceFeedback(),
                correct ? evaluation.expectedValue() : null,
                correct ? evaluation.explanation() : null);
    }
}
