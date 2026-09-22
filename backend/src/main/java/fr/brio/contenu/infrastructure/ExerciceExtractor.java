package fr.brio.contenu.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import fr.brio.contenu.ContenuService;
import fr.brio.contenu.domain.Exercice;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * The single place exercise blocks are turned into {@link Exercice} entities and their
 * correction fields are stripped from the served document. Both origins use it — catalogue
 * ingestion (ADR 0010) and teacher-course publication (ADR 0019). Keeping one implementation
 * is what makes "correction data never reaches a client" a structural guarantee rather than a
 * convention repeated in two places (ADR 0019 §4).
 */
@Component
class ExerciceExtractor {

    private final ObjectMapper objectMapper;

    ExerciceExtractor(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Returns a deep copy of {@code rawDocument} with every {@code exercise} block stripped of
     * its correction fields (and per-choice {@code correct} flag) and tagged with its
     * {@code exerciceId}. The extracted {@link Exercice} entities are appended to {@code out}.
     */
    JsonNode extract(JsonNode rawDocument, ExtractionOwner owner, List<Exercice> out) {
        ObjectNode doc = rawDocument.deepCopy();
        ArrayNode sections = (ArrayNode) doc.get("sections");
        for (JsonNode section : sections) {
            ArrayNode blocks = (ArrayNode) section.get("blocks");
            for (int i = 0; i < blocks.size(); i++) {
                JsonNode block = blocks.get(i);
                if ("exercise".equals(block.get("type").asText())) {
                    blocks.set(i, extractExercice(block, owner, out));
                }
            }
        }
        return doc;
    }

    private ObjectNode extractExercice(JsonNode block, ExtractionOwner owner, List<Exercice> out) {
        String slug = block.get("id").asText();
        String exerciseType = block.has("exerciseType") ? block.get("exerciseType").asText() : "unknown";
        UUID exerciceId = owner.uuidFor(slug);

        ObjectNode evaluation = objectMapper.createObjectNode();
        for (String field : ContenuService.SENSITIVE_EVAL_FIELDS) {
            if (block.has(field)) {
                evaluation.set(field, block.get(field));
            }
        }
        if (block.has("choices")) {
            evaluation.set("choices", block.get("choices"));
        }

        List<String> competencies = new ArrayList<>();
        if (block.has("competencies")) {
            block.get("competencies").forEach(c -> competencies.add(c.asText()));
        }

        // Open enum; may be absent on a block. Null flows through to a "standard" weight later.
        String difficulte = block.hasNonNull("difficulty") ? block.get("difficulty").asText() : null;

        try {
            out.add(owner.newExercice(exerciceId, slug, exerciseType,
                    objectMapper.writeValueAsString(evaluation), competencies, difficulte));
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize evaluation for exercise " + slug, e);
        }

        ObjectNode stripped = block.deepCopy();
        ContenuService.SENSITIVE_EVAL_FIELDS.forEach(stripped::remove);

        if (stripped.has("choices") && stripped.get("choices").isArray()) {
            ArrayNode choices = (ArrayNode) stripped.get("choices");
            for (int i = 0; i < choices.size(); i++) {
                ObjectNode choice = choices.get(i).deepCopy();
                choice.remove("correct");
                choices.set(i, choice);
            }
        }

        stripped.put("exerciceId", exerciceId.toString());
        return stripped;
    }
}
