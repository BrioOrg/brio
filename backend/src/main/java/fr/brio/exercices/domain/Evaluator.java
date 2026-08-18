package fr.brio.exercices.domain;

import com.fasterxml.jackson.databind.JsonNode;

public interface Evaluator {
    String exerciseType();
    EvaluationResult evaluate(String evaluationJson, JsonNode answer);
}
