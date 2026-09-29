package fr.brio.contenu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.api.CatalogueChapitreDto;
import fr.brio.contenu.api.CatalogueMatiereDto;
import fr.brio.contenu.api.CatalogueNiveauDto;
import fr.brio.contenu.api.SectionTerminee;
import fr.brio.contenu.domain.Annale;
import fr.brio.contenu.domain.Chapitre;
import fr.brio.contenu.domain.Exercice;
import fr.brio.contenu.domain.Matiere;
import fr.brio.contenu.domain.Niveau;
import fr.brio.contenu.infrastructure.AnnaleRepository;
import fr.brio.contenu.infrastructure.ChapitreRepository;
import fr.brio.contenu.infrastructure.ExerciceRepository;
import fr.brio.contenu.infrastructure.MatiereRepository;
import fr.brio.contenu.infrastructure.NiveauRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

@Service
public class ContenuService {

    // Scalar fields that contain grading data and must never appear in the chapter
    // JSONB served to clients. They are moved wholesale into contenu.exercices.evaluation.
    // Choices are handled separately: the array is kept in the chapter JSONB but the
    // per-choice "correct" flag is stripped.
    // "multiple" is display-only (radio vs checkbox) and stays in the chapter JSONB.
    // fill-blank: "expected" is the correction and is stripped here; "template" and "bank"
    // are what the student sees and stay in the chapter JSONB.
    public static final List<String> SENSITIVE_EVAL_FIELDS = List.of(
            "answer", "tolerance", "acceptedAnswers",
            "caseSensitive", "referenceAnswer", "rubric", "items",
            "expected"
    );

    private final ChapitreRepository chapitreRepository;
    private final ExerciceRepository exerciceRepository;
    private final NiveauRepository niveauRepository;
    private final MatiereRepository matiereRepository;
    private final AnnaleRepository annaleRepository;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher events;

    ContenuService(
            ChapitreRepository chapitreRepository,
            ExerciceRepository exerciceRepository,
            NiveauRepository niveauRepository,
            MatiereRepository matiereRepository,
            AnnaleRepository annaleRepository,
            ObjectMapper objectMapper,
            ApplicationEventPublisher events) {
        this.chapitreRepository = chapitreRepository;
        this.exerciceRepository = exerciceRepository;
        this.niveauRepository = niveauRepository;
        this.matiereRepository = matiereRepository;
        this.annaleRepository = annaleRepository;
        this.objectMapper = objectMapper;
        this.events = events;
    }

    public List<CatalogueNiveauDto> getCatalogue() {
        List<Niveau> niveaux = niveauRepository.findAllByOrderByOrdreAsc();
        Map<String, String> matiereLibelles = matiereRepository.findAll().stream()
                .collect(Collectors.toMap(Matiere::getCode, Matiere::getLibelle));

        List<Chapitre> published = chapitreRepository
                .findByStatutOrderByNiveauCodeAscMatiereCodeAscOrdreAsc("published");
        // Les annales sont des chapitres spécialisés (ADR 0026) : on les exclut du catalogue des cours.
        Set<String> annaleIds = annaleRepository.findAllChapitreIds();

        Map<String, Map<String, List<CatalogueChapitreDto>>> grouped = new LinkedHashMap<>();
        for (Chapitre ch : published) {
            if (annaleIds.contains(ch.getId())) {
                continue;
            }
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

    /**
     * Records that a student read a section by publishing {@link SectionTerminee}
     * (ADR 0022). The section is validated to exist in the chapter first, so an
     * arbitrary path can never reach progression's journal as a phantom source.
     *
     * @return {@code false} if the chapter or section is unknown (→ 404); the read
     *     itself is trusted (light signal) and made idempotent downstream.
     */
    public boolean marquerSectionLue(String chapitreId, String sectionId, UUID eleveId) {
        Optional<JsonNode> chapitre = findChapitre(chapitreId);
        if (chapitre.isEmpty()) {
            return false;
        }
        boolean sectionExists = false;
        for (JsonNode section : chapitre.get().path("sections")) {
            if (sectionId.equals(section.path("id").asText())) {
                sectionExists = true;
                break;
            }
        }
        if (!sectionExists) {
            return false;
        }
        events.publishEvent(new SectionTerminee(eleveId, chapitreId, sectionId, Instant.now()));
        return true;
    }

    /**
     * Les annales (F7, ADR 0026), de la plus récente à la plus ancienne, avec filtres optionnels.
     * {@code id} = slug du chapitre → le sujet se lit via l'endpoint chapitre par triplet.
     */
    public List<AnnaleDto> listerAnnales(String niveau, String matiere, Integer annee) {
        List<Annale> annales = annaleRepository.findAllByOrderByAnneeDescSessionAsc().stream()
                .filter(a -> niveau == null || niveau.equals(a.getNiveauCode()))
                .filter(a -> matiere == null || matiere.equals(a.getMatiereCode()))
                .filter(a -> annee == null || annee == a.getAnnee())
                .toList();

        Map<String, String> titres = new HashMap<>();
        chapitreRepository.findAllById(annales.stream().map(Annale::getChapitreId).toList())
                .forEach(ch -> titres.put(ch.getId(), ch.getTitre()));

        return annales.stream()
                .map(a -> new AnnaleDto(
                        a.getChapitreId(),
                        titres.getOrDefault(a.getChapitreId(), a.getChapitreId()),
                        a.getExamen(), a.getSession(), a.getAnnee(), a.getCentre(),
                        a.getNiveauCode(), a.getMatiereCode(), a.getDureeMinutes()))
                .toList();
    }

    /**
     * Les exercices d'annales portant une compétence donnée, pour l'entraînement ciblé (F7). La
     * correction n'est jamais renvoyée ; l'énoncé (prompt) est lu du contenu servi de l'annale.
     */
    public List<ExerciceEntrainementDto> entrainementParCompetence(String competence) {
        List<Exercice> exercices = exerciceRepository.findAnnaleExercicesByCompetence(competence);
        if (exercices.isEmpty()) {
            return List.of();
        }

        // Regroupe par chapitre (annale) pour ne charger chaque contenu qu'une fois.
        Set<String> chapitreIds = exercices.stream()
                .map(Exercice::getChapitreId)
                .collect(Collectors.toSet());
        Map<String, String> titres = new HashMap<>();
        Map<String, Map<String, String>> promptsParChapitre = new HashMap<>();
        chapitreRepository.findAllById(chapitreIds).forEach(ch -> {
            titres.put(ch.getId(), ch.getTitre());
            promptsParChapitre.put(ch.getId(), promptsParExerciceId(ch.getContent()));
        });

        return exercices.stream()
                .map(e -> new ExerciceEntrainementDto(
                        e.getId(),
                        promptsParChapitre.getOrDefault(e.getChapitreId(), Map.of())
                                .getOrDefault(e.getId().toString(), ""),
                        e.getType(),
                        e.getChapitreId(),
                        titres.getOrDefault(e.getChapitreId(), e.getChapitreId())))
                .toList();
    }

    // Associe l'id d'exercice (dont le bloc servi est taggé "exerciceId") à son énoncé "prompt".
    private Map<String, String> promptsParExerciceId(String contentJson) {
        Map<String, String> prompts = new HashMap<>();
        try {
            JsonNode doc = objectMapper.readTree(contentJson);
            for (JsonNode section : doc.path("sections")) {
                for (JsonNode block : section.path("blocks")) {
                    String exerciceId = block.path("exerciceId").asText(null);
                    if (exerciceId != null) {
                        prompts.put(exerciceId, block.path("prompt").asText(""));
                    }
                }
            }
        } catch (Exception e) {
            throw new IllegalStateException("Stored annale content is not valid JSON", e);
        }
        return prompts;
    }
}
