package fr.brio.exercices.domain;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
class MultipleChoiceEvaluator implements Evaluator {

    private final ObjectMapper objectMapper;

    MultipleChoiceEvaluator(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public String exerciseType() {
        return "multiple-choice";
    }

    @Override
    public EvaluationResult evaluate(String evaluationJson, JsonNode answer) {
        JsonNode eval;
        try {
            eval = objectMapper.readTree(evaluationJson);
        } catch (Exception e) {
            throw new IllegalStateException("Invalid evaluation JSON", e);
        }

        if (!answer.has("choiceIds") || !answer.get("choiceIds").isArray()) {
            throw new InvalidAnswerException("Answer must contain a 'choiceIds' array");
        }

        Set<String> submitted = new HashSet<>();
        for (JsonNode id : answer.get("choiceIds")) {
            submitted.add(id.asText());
        }

        JsonNode choicesNode = eval.get("choices");
        if (choicesNode == null || !choicesNode.isArray()) {
            throw new IllegalStateException("Evaluation JSON missing 'choices' array");
        }

        Set<String> correctIds = new HashSet<>();
        List<ChoiceFeedback> feedback = new ArrayList<>();
        for (JsonNode choice : choicesNode) {
            String id = choice.get("id").asText();
            boolean isCorrect = choice.has("correct") && choice.get("correct").asBoolean();
            if (isCorrect) {
                correctIds.add(id);
            }
            feedback.add(new ChoiceFeedback(id, isCorrect));
        }

        boolean correct = submitted.equals(correctIds);
        double score = correct ? 1.0 : 0.0;

        String explanation = eval.has("explanation") ? eval.get("explanation").asText() : null;

        return new EvaluationResult(correct, score, feedback, null, explanation);
    }
}
