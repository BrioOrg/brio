package fr.brio.exercices.domain;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * "Texte à trous" — the student fills one or more blanks from a tile bank.
 *
 * Answer shape:      {"blanks": ["c²", ...]}      (one entry per blank, in order)
 * Evaluation shape:  {"expected": ["c²", ...], "caseSensitive": false, "explanation": "..."}
 *
 * Each blank is compared to its expected value with the same accent- and
 * case-insensitive normalisation as short-answer (reused for consistency).
 * `correct` is true only when every blank matches; `score` is the fraction of
 * blanks filled correctly.
 */
@Component
class FillBlankEvaluator implements Evaluator {

    private final ObjectMapper objectMapper;

    FillBlankEvaluator(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public String exerciseType() {
        return "fill-blank";
    }

    @Override
    public EvaluationResult evaluate(String evaluationJson, JsonNode answer) {
        JsonNode eval;
        try {
            eval = objectMapper.readTree(evaluationJson);
        } catch (Exception e) {
            throw new IllegalStateException("Invalid evaluation JSON", e);
        }

        JsonNode expectedNode = eval.get("expected");
        if (expectedNode == null || !expectedNode.isArray() || expectedNode.isEmpty()) {
            throw new IllegalStateException("Evaluation JSON missing 'expected' array");
        }

        JsonNode blanksNode = answer.get("blanks");
        if (blanksNode == null || !blanksNode.isArray()) {
            throw new InvalidAnswerException("Answer must contain a 'blanks' array");
        }
        if (blanksNode.size() != expectedNode.size()) {
            throw new InvalidAnswerException(
                    "Answer must fill exactly " + expectedNode.size() + " blank(s)");
        }

        boolean caseSensitive = eval.has("caseSensitive") && eval.get("caseSensitive").asBoolean();

        int correctCount = 0;
        for (int i = 0; i < expectedNode.size(); i++) {
            JsonNode blank = blanksNode.get(i);
            if (blank == null || !blank.isTextual() || blank.asText().isBlank()) {
                throw new InvalidAnswerException("Blank " + (i + 1) + " must be a non-empty string");
            }
            String submitted = ShortAnswerEvaluator.normalise(blank.asText(), caseSensitive);
            String expected = ShortAnswerEvaluator.normalise(expectedNode.get(i).asText(), caseSensitive);
            if (submitted.equals(expected)) {
                correctCount++;
            }
        }

        boolean correct = correctCount == expectedNode.size();
        double score = (double) correctCount / expectedNode.size();
        String explanation = eval.has("explanation") ? eval.get("explanation").asText() : null;

        return new EvaluationResult(correct, score, List.of(), null, explanation);
    }
}
