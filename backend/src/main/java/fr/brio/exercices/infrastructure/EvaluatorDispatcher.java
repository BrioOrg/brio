package fr.brio.exercices.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import fr.brio.exercices.domain.EvaluationResult;
import fr.brio.exercices.domain.Evaluator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class EvaluatorDispatcher {

    private final Map<String, Evaluator> evaluators;

    EvaluatorDispatcher(List<Evaluator> evaluators) {
        this.evaluators = evaluators.stream()
                .collect(Collectors.toMap(Evaluator::exerciseType, Function.identity()));
    }

    public EvaluationResult dispatch(String exerciseType, String evaluationJson, JsonNode answer) {
        Evaluator evaluator = evaluators.get(exerciseType);
        if (evaluator == null) {
            throw new UnsupportedExerciseTypeException(exerciseType);
        }
        return evaluator.evaluate(evaluationJson, answer);
    }
}
