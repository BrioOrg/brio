package fr.brio.exercices.web;

import fr.brio.exercices.SoumissionResult;
import fr.brio.exercices.domain.ChoiceFeedback;
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
    static SoumissionResponse from(SoumissionResult result) {
        return new SoumissionResponse(
                result.soumissionId(),
                result.evaluation().correct(),
                result.evaluation().score(),
                result.evaluation().choiceFeedback(),
                result.evaluation().expectedValue(),
                result.evaluation().explanation());
    }
}
