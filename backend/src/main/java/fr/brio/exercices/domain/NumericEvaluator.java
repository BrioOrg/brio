package fr.brio.exercices.domain;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
class NumericEvaluator implements Evaluator {

    private final ObjectMapper objectMapper;

    NumericEvaluator(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public String exerciseType() {
        return "numeric";
    }

    @Override
    public EvaluationResult evaluate(String evaluationJson, JsonNode answer) {
        JsonNode eval;
        try {
            eval = objectMapper.readTree(evaluationJson);
        } catch (Exception e) {
            throw new IllegalStateException("Invalid evaluation JSON", e);
        }

        if (!answer.has("value") || !answer.get("value").isNumber()) {
            throw new InvalidAnswerException("Answer must contain a numeric 'value' field");
        }

        double submitted = answer.get("value").asDouble();
        double expected = eval.get("answer").asDouble();
        double tolerance = eval.has("tolerance") ? eval.get("tolerance").asDouble() : 0.0;

        boolean correct = Math.abs(submitted - expected) <= tolerance;
        double score = correct ? 1.0 : 0.0;

        String explanation = eval.has("explanation") ? eval.get("explanation").asText() : null;

        return new EvaluationResult(correct, score, List.of(), expected, explanation);
    }
}
