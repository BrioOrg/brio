package fr.brio.contenu.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import fr.brio.contenu.ContenuService;
import fr.brio.contenu.InvalidContentException;
import fr.brio.contenu.domain.Chapitre;
import fr.brio.contenu.domain.Competence;
import fr.brio.contenu.domain.Exercice;
import fr.brio.contenu.domain.Matiere;
import fr.brio.contenu.domain.Niveau;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class ChapitreIngestionTx {

    static final int INGEST_VERSION = 1;

    private static final ObjectMapper CANONICAL_MAPPER = JsonMapper.builder()
            .configure(com.fasterxml.jackson.databind.MapperFeature.SORT_PROPERTIES_ALPHABETICALLY, true)
            .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true)
            .build();

    private final ChapitreRepository chapitreRepository;
    private final ExerciceRepository exerciceRepository;
    private final CompetenceRepository competenceRepository;
    private final NiveauRepository niveauRepository;
    private final MatiereRepository matiereRepository;
    private final ContentSchemaValidator validator;
    private final ObjectMapper objectMapper;

    ChapitreIngestionTx(
            ChapitreRepository chapitreRepository,
            ExerciceRepository exerciceRepository,
            CompetenceRepository competenceRepository,
            NiveauRepository niveauRepository,
            MatiereRepository matiereRepository,
            ContentSchemaValidator validator,
            ObjectMapper objectMapper) {
        this.chapitreRepository = chapitreRepository;
        this.exerciceRepository = exerciceRepository;
        this.competenceRepository = competenceRepository;
        this.niveauRepository = niveauRepository;
        this.matiereRepository = matiereRepository;
        this.validator = validator;
        this.objectMapper = objectMapper;
    }

    @Transactional
    ChapterResult ingestDocument(JsonNode doc, String niveau, String matiere, int ordre) {
        String chapitreId = doc.path("id").asText();
        String hash = computeHash(doc);

        Optional<Chapitre> existing = chapitreRepository.findById(chapitreId);
        if (existing.isPresent() && hash.equals(existing.get().getContentHash())) {
            return new ChapterResult(chapitreId, ChapterResult.Status.SKIPPED, null);
        }

        validator.validate(doc);
        assertCompetenciesExist(doc);
        assertNiveauAndMatiereExist(doc);

        String titre = doc.get("title").asText();
        int duree = doc.path("estimatedDurationMinutes").asInt(0);
        String statut = doc.path("status").asText("published");

        // Pre-fetch existing exercises to reuse UUIDs (ADR 0010).
        Map<String, UUID> existingUuids = existing.isEmpty()
                ? Map.of()
                : exerciceRepository.findByChapitreId(chapitreId).stream()
                        .collect(Collectors.toMap(Exercice::getSlug, Exercice::getId));

        List<Exercice> newExercices = new ArrayList<>();
        JsonNode contentDoc = buildContentDocument(doc, chapitreId, newExercices, existingUuids);
        String contentJson;
        try {
            contentJson = objectMapper.writeValueAsString(contentDoc);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize content for chapter " + chapitreId, e);
        }

        if (existing.isEmpty()) {
            chapitreRepository.save(new Chapitre(
                    chapitreId, contentJson, niveau, matiere, ordre, statut, titre, duree, hash));
            exerciceRepository.saveAll(newExercices);
            return new ChapterResult(chapitreId, ChapterResult.Status.CREATED, null);
        }

        Chapitre chapitre = existing.get();
        chapitre.update(contentJson, hash, titre, duree, statut, ordre);
        chapitreRepository.save(chapitre);

        upsertExercices(chapitreId, newExercices, existingUuids.keySet());
        return new ChapterResult(chapitreId, ChapterResult.Status.UPDATED, null);
    }

    private void upsertExercices(String chapitreId, List<Exercice> newExercices, Set<String> existingSlugSet) {
        // Load full entities for update and retire operations.
        Map<String, Exercice> existingBySlug = exerciceRepository.findByChapitreId(chapitreId).stream()
                .collect(Collectors.toMap(Exercice::getSlug, e -> e));

        Set<String> newSlugs = newExercices.stream().map(Exercice::getSlug).collect(Collectors.toSet());

        for (Exercice newEx : newExercices) {
            Exercice existingEx = existingBySlug.get(newEx.getSlug());
            if (existingEx != null) {
                existingEx.update(newEx.getType(), newEx.getEvaluation(), newEx.getCompetencies());
                exerciceRepository.save(existingEx);
            } else {
                exerciceRepository.save(newEx);
            }
        }

        for (Exercice existingEx : existingBySlug.values()) {
            if (!newSlugs.contains(existingEx.getSlug()) && existingEx.getRetiredAt() == null) {
                existingEx.retire();
                exerciceRepository.save(existingEx);
            }
        }
    }

    private void assertCompetenciesExist(JsonNode rawDocument) {
        Set<String> referenced = new TreeSet<>();
        rawDocument.findValues("competencies")
                .forEach(array -> array.forEach(code -> referenced.add(code.asText())));
        if (referenced.isEmpty()) {
            return;
        }
        Set<String> known = competenceRepository.findAllById(referenced).stream()
                .map(Competence::getCode)
                .collect(HashSet::new, HashSet::add, HashSet::addAll);
        Set<String> unknown = new TreeSet<>(referenced);
        unknown.removeAll(known);
        if (!unknown.isEmpty()) {
            throw new InvalidContentException(
                    "Unknown competency code(s), absent from the referential: " + String.join(", ", unknown));
        }
    }

    private void assertNiveauAndMatiereExist(JsonNode rawDocument) {
        String level = rawDocument.path("level").asText();
        String subject = rawDocument.path("subject").asText();
        if (!niveauRepository.existsById(level)) {
            throw new InvalidContentException("Unknown niveau: '" + level + "' — add it to contenu.niveaux first");
        }
        if (!matiereRepository.existsById(subject)) {
            throw new InvalidContentException("Unknown matiere: '" + subject + "' — add it to contenu.matieres first");
        }
    }

    private JsonNode buildContentDocument(JsonNode rawDocument, String chapitreId,
                                          List<Exercice> exercices, Map<String, UUID> existingUuids) {
        ObjectNode doc = rawDocument.deepCopy();
        ArrayNode sections = (ArrayNode) doc.get("sections");
        for (JsonNode section : sections) {
            ArrayNode blocks = (ArrayNode) section.get("blocks");
            for (int i = 0; i < blocks.size(); i++) {
                JsonNode block = blocks.get(i);
                if ("exercise".equals(block.get("type").asText())) {
                    ObjectNode stripped = extractExercice(block, chapitreId, exercices, existingUuids);
                    blocks.set(i, stripped);
                }
            }
        }
        return doc;
    }

    private ObjectNode extractExercice(JsonNode block, String chapitreId,
                                       List<Exercice> exercices, Map<String, UUID> existingUuids) {
        String slug = block.get("id").asText();
        String exerciseType = block.has("exerciseType") ? block.get("exerciseType").asText() : "unknown";
        UUID exerciceId = existingUuids.getOrDefault(slug, UUID.randomUUID());

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

        try {
            exercices.add(new Exercice(
                    exerciceId, chapitreId, slug, exerciseType,
                    objectMapper.writeValueAsString(evaluation),
                    competencies));
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

    String computeHash(JsonNode document) {
        try {
            String canonical = CANONICAL_MAPPER.writeValueAsString(document);
            String input = canonical + INGEST_VERSION;
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to compute content hash", e);
        }
    }
}
