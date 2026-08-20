package fr.brio.contenu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.api.CatalogueChapitreDto;
import fr.brio.contenu.api.CatalogueMatiereDto;
import fr.brio.contenu.api.CatalogueNiveauDto;
import fr.brio.contenu.domain.Chapitre;
import fr.brio.contenu.domain.Exercice;
import fr.brio.contenu.domain.Matiere;
import fr.brio.contenu.domain.Niveau;
import fr.brio.contenu.infrastructure.ChapitreRepository;
import fr.brio.contenu.infrastructure.ExerciceRepository;
import fr.brio.contenu.infrastructure.MatiereRepository;
import fr.brio.contenu.infrastructure.NiveauRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class ContenuService {

    // Scalar fields that contain grading data and must never appear in the chapter
    // JSONB served to clients. They are moved wholesale into contenu.exercices.evaluation.
    // Choices are handled separately: the array is kept in the chapter JSONB but the
    // per-choice "correct" flag is stripped.
    // "multiple" is display-only (radio vs checkbox) and stays in the chapter JSONB.
    public static final List<String> SENSITIVE_EVAL_FIELDS = List.of(
            "answer", "tolerance", "acceptedAnswers",
            "caseSensitive", "referenceAnswer", "rubric", "items"
    );

    private final ChapitreRepository chapitreRepository;
    private final ExerciceRepository exerciceRepository;
    private final NiveauRepository niveauRepository;
    private final MatiereRepository matiereRepository;
    private final ObjectMapper objectMapper;

    ContenuService(
            ChapitreRepository chapitreRepository,
            ExerciceRepository exerciceRepository,
            NiveauRepository niveauRepository,
            MatiereRepository matiereRepository,
            ObjectMapper objectMapper) {
        this.chapitreRepository = chapitreRepository;
        this.exerciceRepository = exerciceRepository;
        this.niveauRepository = niveauRepository;
        this.matiereRepository = matiereRepository;
        this.objectMapper = objectMapper;
    }

    public List<CatalogueNiveauDto> getCatalogue() {
        List<Niveau> niveaux = niveauRepository.findAllByOrderByOrdreAsc();
        Map<String, String> matiereLibelles = matiereRepository.findAll().stream()
                .collect(Collectors.toMap(Matiere::getCode, Matiere::getLibelle));

        List<Chapitre> published = chapitreRepository
                .findByStatutOrderByNiveauCodeAscMatiereCodeAscOrdreAsc("published");

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
}
