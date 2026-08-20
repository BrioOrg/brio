package fr.brio.contenu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import fr.brio.contenu.api.CatalogueChapitreDto;
import fr.brio.contenu.api.CatalogueMatiereDto;
import fr.brio.contenu.api.CatalogueNiveauDto;
import fr.brio.contenu.domain.Chapitre;
import fr.brio.contenu.domain.Competence;
import fr.brio.contenu.domain.Exercice;
import fr.brio.contenu.domain.Matiere;
import fr.brio.contenu.domain.Niveau;
import fr.brio.contenu.infrastructure.ChapitreRepository;
import fr.brio.contenu.infrastructure.CompetenceRepository;
import fr.brio.contenu.infrastructure.ContentSchemaValidator;
import fr.brio.contenu.infrastructure.ExerciceRepository;
import fr.brio.contenu.infrastructure.MatiereRepository;
import fr.brio.contenu.infrastructure.NiveauRepository;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContenuService {

    // Scalar fields that contain grading data and must never appear in the chapter
    // JSONB served to clients. They are moved wholesale into contenu.exercices.evaluation.
    // Choices are handled separately: the array is kept in the chapter JSONB but the
    // per-choice "correct" flag is stripped (see extractExercice).
    // "multiple" is display-only (radio vs checkbox) and stays in the chapter JSONB.
    public static final List<String> SENSITIVE_EVAL_FIELDS = List.of(
            "answer", "tolerance", "acceptedAnswers",
            "caseSensitive", "referenceAnswer", "rubric", "items"
    );

    private final ChapitreRepository chapitreRepository;
    private final ExerciceRepository exerciceRepository;
    private final CompetenceRepository competenceRepository;
    private final NiveauRepository niveauRepository;
    private final MatiereRepository matiereRepository;
    private final ContentSchemaValidator validator;
    private final ObjectMapper objectMapper;

    ContenuService(
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

    public void ingestChapitre(JsonNode rawDocument) {
        ingestChapitre(rawDocument, 0);
    }

    @Transactional
    public void ingestChapitre(JsonNode rawDocument, int ordre) {
        validator.validate(rawDocument);
        assertCompetenciesExist(rawDocument);
        assertNiveauAndMatiereExist(rawDocument);

        String chapitreId = rawDocument.get("id").asText();
        if (chapitreRepository.existsById(chapitreId)) {
            return;
        }

        String niveauCode = rawDocument.get("level").asText();
        String matiereCode = rawDocument.get("subject").asText();
        String titre = rawDocument.get("title").asText();
        int duree = rawDocument.path("estimatedDurationMinutes").asInt(0);

        List<Exercice> exercices = new ArrayList<>();
        JsonNode contentDoc = buildContentDocument(rawDocument, chapitreId, exercices);

        try {
            String contentJson = objectMapper.writeValueAsString(contentDoc);
            chapitreRepository.save(new Chapitre(
                    chapitreId, contentJson, niveauCode, matiereCode,
                    ordre, "published", titre, duree));
            exerciceRepository.saveAll(exercices);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to persist chapter " + chapitreId, e);
        }
    }

    public List<CatalogueNiveauDto> getCatalogue() {
        List<Niveau> niveaux = niveauRepository.findAllByOrderByOrdreAsc();
        Map<String, String> matiereLibelles = matiereRepository.findAll().stream()
                .collect(Collectors.toMap(Matiere::getCode, Matiere::getLibelle));

        List<Chapitre> published = chapitreRepository
                .findByStatutOrderByNiveauCodeAscMatiereCodeAscOrdreAsc("published");

        // Group chapters by niveauCode then matiereCode, preserving insertion order
        Map<String, Map<String, List<CatalogueChapitreDto>>> grouped = new LinkedHashMap<>();
        for (Chapitre ch : published) {
            grouped
                    .computeIfAbsent(ch.getNiveauCode(), k -> new LinkedHashMap<>())
                    .computeIfAbsent(ch.getMatiereCode(), k -> new ArrayList<>())
                    .add(new CatalogueChapitreDto(
                            ch.getId(), ch.getTitre(), ch.getDureeEstimeeMinutes(), ch.getOrdre()));
        }

        return niveaux.stream()
                .filter(n -> grouped.containsKey(n.getCode()))
                .map(n -> new CatalogueNiveauDto(
                        n.getCode(), n.getLibelle(),
                        grouped.get(n.getCode()).entrySet().stream()
                                .map(e -> new CatalogueMatiereDto(
                                        e.getKey(),
                                        matiereLibelles.getOrDefault(e.getKey(), e.getKey()),
                                        e.getValue()))
                                .toList()))
                .toList();
    }

    public Optional<JsonNode> findChapitreByTriplet(String niveauCode, String matiereCode, String slug) {
        return chapitreRepository.findByNiveauCodeAndMatiereCodeAndId(niveauCode, matiereCode, slug)
                .map(ch -> {
                    try {
                        return objectMapper.readTree(ch.getContent());
                    } catch (Exception e) {
                        throw new IllegalStateException(
                                "Stored chapter content is not valid JSON: " + slug, e);
                    }
                });
    }

    public Optional<ChapitreRef> findChapitreRef(String id) {
        return chapitreRepository.findById(id)
                .map(ch -> new ChapitreRef(ch.getNiveauCode(), ch.getMatiereCode(), ch.getId()));
    }

    public Optional<UUID> findExerciceIdByChapitreAndSlug(String chapitreId, String slug) {
        return exerciceRepository.findByChapitreIdAndSlug(chapitreId, slug)
                .map(Exercice::getId);
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

    // Second stage of the two-stage guarantee (ADR 0009; the first is the CI
    // check script): a chapter referencing a code absent from the referential
    // is rejected before anything is written.
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

    // Validates that the chapter's level and subject fields are registered reference
    // values (ADR 0011). Rejects before any write occurs.
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
        UUID exerciceId = UUID.randomUUID();

        // Build evaluation jsonb: scalar sensitive fields + full choices array (with correct flags).
        ObjectNode evaluation = objectMapper.createObjectNode();
        for (String field : SENSITIVE_EVAL_FIELDS) {
            if (block.has(field)) {
                evaluation.set(field, block.get(field));
            }
        }
        if (block.has("choices")) {
            evaluation.set("choices", block.get("choices"));
        }

        // Collect competencies for the denormalised column
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

        // Build the chapter-safe block: strip scalar sensitive fields, strip "correct" from
        // each choice but keep id/text, keep "multiple" (display-only), add exerciceId.
        ObjectNode stripped = block.deepCopy();
        SENSITIVE_EVAL_FIELDS.forEach(stripped::remove);

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
