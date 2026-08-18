package fr.brio.contenu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import fr.brio.contenu.domain.Chapitre;
import fr.brio.contenu.domain.Exercice;
import fr.brio.contenu.infrastructure.ChapitreRepository;
import fr.brio.contenu.infrastructure.ContentSchemaValidator;
import fr.brio.contenu.infrastructure.ExerciceRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContenuService {

    // Fields that must never appear in the chapter jsonb served to clients.
    // Ingestion strips these from exercise blocks and moves them to contenu.exercices.
    public static final List<String> EVALUATION_FIELDS = List.of(
            "choices", "answer", "tolerance", "acceptedAnswers",
            "caseSensitive", "referenceAnswer", "rubric", "multiple", "items"
    );

    private final ChapitreRepository chapitreRepository;
    private final ExerciceRepository exerciceRepository;
    private final ContentSchemaValidator validator;
    private final ObjectMapper objectMapper;

    ContenuService(
            ChapitreRepository chapitreRepository,
            ExerciceRepository exerciceRepository,
            ContentSchemaValidator validator,
            ObjectMapper objectMapper) {
        this.chapitreRepository = chapitreRepository;
        this.exerciceRepository = exerciceRepository;
        this.validator = validator;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void ingestChapitre(JsonNode rawDocument) {
        validator.validate(rawDocument);

        String chapitreId = rawDocument.get("id").asText();
        if (chapitreRepository.existsById(chapitreId)) {
            return;
        }

        List<Exercice> exercices = new ArrayList<>();
        JsonNode contentDoc = buildContentDocument(rawDocument, chapitreId, exercices);

        try {
            String contentJson = objectMapper.writeValueAsString(contentDoc);
            chapitreRepository.save(new Chapitre(chapitreId, contentJson));
            exerciceRepository.saveAll(exercices);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to persist chapter " + chapitreId, e);
        }
    }

    public Optional<JsonNode> findChapitre(String id) {
        return chapitreRepository.findById(id).map(ch -> {
            try {
                return objectMapper.readTree(ch.getContent());
            } catch (Exception e) {
                throw new IllegalStateException("Stored chapter content is not valid JSON: " + id, e);
            }
        });
    }

    private JsonNode buildContentDocument(JsonNode rawDocument, String chapitreId, List<Exercice> exercices) {
        ObjectNode doc = rawDocument.deepCopy();
        ArrayNode sections = (ArrayNode) doc.get("sections");
        for (JsonNode section : sections) {
            ArrayNode blocks = (ArrayNode) section.get("blocks");
            for (int i = 0; i < blocks.size(); i++) {
                JsonNode block = blocks.get(i);
                if ("exercise".equals(block.get("type").asText())) {
                    ObjectNode stripped = extractExercice(block, chapitreId, exercices);
                    blocks.set(i, stripped);
                }
            }
        }
        return doc;
    }

    private ObjectNode extractExercice(JsonNode block, String chapitreId, List<Exercice> exercices) {
        String slug = block.get("id").asText();
        String exerciseType = block.has("exerciseType") ? block.get("exerciseType").asText() : "unknown";

        // Build evaluation jsonb from the type-specific fields
        ObjectNode evaluation = objectMapper.createObjectNode();
        for (String field : EVALUATION_FIELDS) {
            if (block.has(field)) {
                evaluation.set(field, block.get(field));
            }
        }

        // Collect competencies for the denormalised column
        List<String> competencies = new ArrayList<>();
        if (block.has("competencies")) {
            block.get("competencies").forEach(c -> competencies.add(c.asText()));
        }

        try {
            exercices.add(new Exercice(
                    chapitreId, slug, exerciseType,
                    objectMapper.writeValueAsString(evaluation),
                    competencies));
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize evaluation for exercise " + slug, e);
        }

        // Return the block with evaluation fields removed
        ObjectNode stripped = block.deepCopy();
        EVALUATION_FIELDS.forEach(stripped::remove);
        return stripped;
    }
}
