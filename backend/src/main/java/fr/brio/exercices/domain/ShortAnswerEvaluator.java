package fr.brio.exercices.domain;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.text.Normalizer;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
class ShortAnswerEvaluator implements Evaluator {

    private final ObjectMapper objectMapper;

    ShortAnswerEvaluator(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public String exerciseType() {
        return "short-answer";
    }

    @Override
    public EvaluationResult evaluate(String evaluationJson, JsonNode answer) {
        JsonNode eval;
        try {
            eval = objectMapper.readTree(evaluationJson);
        } catch (Exception e) {
            throw new IllegalStateException("Invalid evaluation JSON", e);
        }

        if (!answer.has("text") || !answer.get("text").isTextual()) {
            throw new InvalidAnswerException("Answer must contain a 'text' string field");
        }

        String raw = answer.get("text").asText();
        if (raw.isBlank()) {
            throw new InvalidAnswerException("Answer text must not be blank");
        }

        JsonNode answersNode = eval.get("acceptedAnswers");
        if (answersNode == null || !answersNode.isArray() || answersNode.isEmpty()) {
            throw new IllegalStateException("Evaluation JSON missing 'acceptedAnswers' array");
        }

        boolean caseSensitive = eval.has("caseSensitive") && eval.get("caseSensitive").asBoolean();

        String normalised = normalise(raw, caseSensitive);
        boolean correct = false;
        for (JsonNode accepted : answersNode) {
            if (normalised.equals(normalise(accepted.asText(), caseSensitive))) {
                correct = true;
                break;
            }
        }

        double score = correct ? 1.0 : 0.0;
        String explanation = eval.has("explanation") ? eval.get("explanation").asText() : null;

        return new EvaluationResult(correct, score, List.of(), null, explanation);
    }

    // Pipeline: trim → NFD + strip combining marks → lowercase (unless caseSensitive) → strip trailing [\s.!?;]+
    static String normalise(String text, boolean caseSensitive) {
        String result = text.trim();
        result = Normalizer.normalize(result, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        if (!caseSensitive) {
            result = result.toLowerCase();
        }
        result = result.replaceAll("[\\s.!?;]+$", "");
        return result;
    }
}
