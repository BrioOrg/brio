package fr.brio.ia.eval;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import fr.brio.contenu.api.Block;
import fr.brio.contenu.api.ChapitreContentApi;
import fr.brio.contenu.api.ChapitreDocument;
import fr.brio.contenu.api.ExerciceDefinition;
import fr.brio.contenu.api.ExerciseBlock;
import fr.brio.contenu.api.Section;
import fr.brio.contenu.api.TextBlock;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * ChapitreContentApi implementation for the eval harness.
 * Reads chapter JSON directly from content/chapitres/ (the git source of truth — ADR 0008).
 * No database, no Spring context needed.
 *
 * Exercise blocks get a deterministic UUID derived from their block ID so that the same
 * chapter always produces the same exerciceId across eval runs, and so the eval YAML can
 * reference exercises by their stable block ID rather than a DB-assigned UUID.
 */
class EvalChapitreAdapter implements ChapitreContentApi {

    private final Path contentDir;
    private final Map<UUID, ExerciceDefinition> exerciceMap;
    private final ObjectMapper objectMapper;
    private final Map<String, ChapitreDocument> cache = new HashMap<>();

    EvalChapitreAdapter(Path contentDir, Map<UUID, ExerciceDefinition> exerciceMap, ObjectMapper objectMapper) {
        this.contentDir = contentDir;
        this.exerciceMap = exerciceMap;
        this.objectMapper = objectMapper;
    }

    @Override
    public Optional<ChapitreDocument> findByTriplet(String niveau, String matiere, String slug) {
        String cacheKey = niveau + "/" + matiere + "/" + slug;
        if (cache.containsKey(cacheKey)) {
            return Optional.of(cache.get(cacheKey));
        }
        Path jsonPath = contentDir.resolve(niveau).resolve(matiere).resolve(slug + ".json");
        if (!jsonPath.toFile().exists()) {
            return Optional.empty();
        }
        try {
            JsonNode doc = objectMapper.readTree(jsonPath.toFile());
            ChapitreDocument document = toDocument(doc);
            cache.put(cacheKey, document);
            return Optional.of(document);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to load chapter: " + jsonPath, e);
        }
    }

    private ChapitreDocument toDocument(JsonNode doc) {
        String id = doc.path("id").asText();
        List<Section> sections = new ArrayList<>();
        for (JsonNode s : doc.path("sections")) {
            sections.add(toSection(s));
        }
        return new ChapitreDocument(id, sections);
    }

    private Section toSection(JsonNode s) {
        String id = s.path("id").asText();
        List<Block> blocks = new ArrayList<>();
        for (JsonNode b : s.path("blocks")) {
            blocks.add(toBlock(b));
        }
        return new Section(id, blocks);
    }

    private Block toBlock(JsonNode b) {
        String id = b.path("id").asText();
        String type = b.path("type").asText();
        if ("exercise".equals(type)) {
            UUID exerciceId = deterministicUuid(id);
            exerciceMap.put(exerciceId, toExerciceDefinition(exerciceId, b));
            return new ExerciseBlock(id, type, b.path("prompt").asText(""), exerciceId);
        }
        String text = b.has("text") ? b.path("text").asText("")
                : b.has("latex") ? b.path("latex").asText("")
                : b.path("alt").asText("");
        return new TextBlock(id, type, text);
    }

    private ExerciceDefinition toExerciceDefinition(UUID exerciceId, JsonNode b) {
        String exerciseType = b.path("exerciseType").asText("numeric");
        String type;
        String evaluationJson;
        if ("numeric".equals(exerciseType)) {
            type = "numeric";
            ObjectNode eval = objectMapper.createObjectNode();
            eval.put("answer", b.path("answer").asText());
            eval.put("tolerance", b.path("tolerance").asDouble(0.0));
            evaluationJson = eval.toString();
        } else if ("multiple-choice".equals(exerciseType)) {
            type = "multiple-choice";
            ObjectNode eval = objectMapper.createObjectNode();
            eval.set("choices", b.path("choices"));
            evaluationJson = eval.toString();
        } else {
            type = exerciseType;
            evaluationJson = "{}";
        }
        return new ExerciceDefinition(exerciceId, type, List.of(), evaluationJson);
    }

    static UUID deterministicUuid(String blockId) {
        return UUID.nameUUIDFromBytes(("eval:" + blockId).getBytes(StandardCharsets.UTF_8));
    }
}
