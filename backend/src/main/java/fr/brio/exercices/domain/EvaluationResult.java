package fr.brio.exercices.domain;

import java.util.List;

public record EvaluationResult(
        boolean correct,
        double score,
        List<ChoiceFeedback> choiceFeedback,
        Double expectedValue,
        String explanation
) {
    public EvaluationResult {
        choiceFeedback = choiceFeedback != null ? List.copyOf(choiceFeedback) : List.of();
    }
}
