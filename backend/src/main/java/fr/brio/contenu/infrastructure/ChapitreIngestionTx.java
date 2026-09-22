package fr.brio.contenu.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import fr.brio.contenu.InvalidContentException;
import fr.brio.contenu.api.ChapitrePublie;
import fr.brio.contenu.domain.Chapitre;
import fr.brio.contenu.domain.Exercice;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class ChapitreIngestionTx {

    // Bumped 1 → 2 for #103: exercises now carry `difficulte`. The bump changes the content
    // hash so unchanged chapters take the UPDATE path and backfill the new column, instead of
    // being SKIPPED (the skip path never rebuilds exercise entities).
    static final int INGEST_VERSION = 2;

    private static final ObjectMapper CANONICAL_MAPPER = JsonMapper.builder()
            .configure(com.fasterxml.jackson.databind.MapperFeature.SORT_PROPERTIES_ALPHABETICALLY, true)
            .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true)
            .build();

    private final ChapitreRepository chapitreRepository;
    private final ExerciceRepository exerciceRepository;
    private final NiveauRepository niveauRepository;
    private final MatiereRepository matiereRepository;
    private final ContentSchemaValidator validator;
    private final ContentReferentialValidator referentialValidator;
    private final ExerciceExtractor exerciceExtractor;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher events;

    ChapitreIngestionTx(
            ChapitreRepository chapitreRepository,
            ExerciceRepository exerciceRepository,
            NiveauRepository niveauRepository,
            MatiereRepository matiereRepository,
            ContentSchemaValidator validator,
            ContentReferentialValidator referentialValidator,
            ExerciceExtractor exerciceExtractor,
            ObjectMapper objectMapper,
            ApplicationEventPublisher events) {
        this.chapitreRepository = chapitreRepository;
        this.exerciceRepository = exerciceRepository;
        this.niveauRepository = niveauRepository;
        this.matiereRepository = matiereRepository;
        this.validator = validator;
        this.referentialValidator = referentialValidator;
        this.exerciceExtractor = exerciceExtractor;
        this.objectMapper = objectMapper;
        this.events = events;
    }

    @Transactional
    ChapterResult ingestDocument(JsonNode doc, String niveau, String matiere, int ordre) {
        String chapitreId = doc.path("id").asText();
        String hash = computeHash(doc);

        Optional<Chapitre> existing = chapitreRepository.findById(chapitreId);
        if (existing.isPresent() && hash.equals(existing.get().getContentHash())) {
            // Content unchanged, but ordre comes from _index.json (not the hash) and
            // progression's projection may not exist yet: re-announce the structure so
            // the read-model converges on every run (idempotent for consumers).
            publierStructure(doc, chapitreId, niveau, matiere, ordre);
            return new ChapterResult(chapitreId, ChapterResult.Status.SKIPPED, null);
        }

        validator.validate(doc);
        referentialValidator.assertCompetenciesExist(doc);
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
        JsonNode contentDoc = exerciceExtractor.extract(
                doc, new ExtractionOwner.CatalogueOwner(chapitreId, existingUuids), newExercices);
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
            publierStructure(doc, chapitreId, niveau, matiere, ordre);
            return new ChapterResult(chapitreId, ChapterResult.Status.CREATED, null);
        }

        Chapitre chapitre = existing.get();
        chapitre.update(contentJson, hash, titre, duree, statut, ordre);
        chapitreRepository.save(chapitre);

        upsertExercices(chapitreId, newExercices, existingUuids.keySet());
        publierStructure(doc, chapitreId, niveau, matiere, ordre);
        return new ChapterResult(chapitreId, ChapterResult.Status.UPDATED, null);
    }

    /**
     * Announces the chapter's structure for progression's projection (ADR 0022).
     * Counts are read straight from the document so they stay correct on the SKIPPED
     * path too, where the exercise entities are not rebuilt.
     */
    private void publierStructure(JsonNode doc, String chapitreId, String niveau, String matiere, int ordre) {
        JsonNode sections = doc.path("sections");
        int totalSections = sections.isArray() ? sections.size() : 0;
        int totalExercices = 0;
        for (JsonNode section : sections) {
            for (JsonNode block : section.path("blocks")) {
                if ("exercise".equals(block.path("type").asText())) {
                    totalExercices++;
                }
            }
        }
        String statut = doc.path("status").asText("published");
        events.publishEvent(new ChapitrePublie(
                chapitreId, niveau, matiere, ordre, statut, totalSections, totalExercices));
    }

    private void upsertExercices(String chapitreId, List<Exercice> newExercices, Set<String> existingSlugSet) {
        // Load full entities for update and retire operations.
        Map<String, Exercice> existingBySlug = exerciceRepository.findByChapitreId(chapitreId).stream()
                .collect(Collectors.toMap(Exercice::getSlug, e -> e));

        Set<String> newSlugs = newExercices.stream().map(Exercice::getSlug).collect(Collectors.toSet());

        for (Exercice newEx : newExercices) {
            Exercice existingEx = existingBySlug.get(newEx.getSlug());
            if (existingEx != null) {
                existingEx.update(newEx.getType(), newEx.getEvaluation(),
                        newEx.getCompetencies(), newEx.getDifficulte());
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
