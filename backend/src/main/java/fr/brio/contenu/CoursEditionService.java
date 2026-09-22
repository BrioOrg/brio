package fr.brio.contenu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.api.CreerBrouillonCommand;
import fr.brio.contenu.api.ModifierBrouillonCommand;
import fr.brio.contenu.api.PublicationResult;
import fr.brio.contenu.domain.Cours;
import fr.brio.contenu.domain.CoursPortee;
import fr.brio.contenu.domain.CoursVersion;
import fr.brio.contenu.domain.Exercice;
import fr.brio.contenu.infrastructure.CoursPorteeRepository;
import fr.brio.contenu.infrastructure.CoursRepository;
import fr.brio.contenu.infrastructure.CoursVersionRepository;
import fr.brio.contenu.infrastructure.ExerciceExtractor;
import fr.brio.contenu.infrastructure.ExerciceRepository;
import fr.brio.contenu.infrastructure.PublicationValidator;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Draft → publication for teacher-authored courses (ADR 0019 §4). "Enregistrer" writes a
 * mutable draft; "Publier" validates it and freezes an immutable version visible to the
 * course's classes. Correction fields never reach the stored published content: the shared
 * {@link ExerciceExtractor} strips them into {@code contenu.exercices}, exactly as catalogue
 * ingestion does. Exposed to the (later) web tranche through this service and the api records.
 */
@Service
public class CoursEditionService {

    private final CoursRepository coursRepository;
    private final CoursVersionRepository coursVersionRepository;
    private final CoursPorteeRepository coursPorteeRepository;
    private final ExerciceRepository exerciceRepository;
    private final ExerciceExtractor exerciceExtractor;
    private final PublicationValidator publicationValidator;
    private final ObjectMapper objectMapper;

    CoursEditionService(
            CoursRepository coursRepository,
            CoursVersionRepository coursVersionRepository,
            CoursPorteeRepository coursPorteeRepository,
            ExerciceRepository exerciceRepository,
            ExerciceExtractor exerciceExtractor,
            PublicationValidator publicationValidator,
            ObjectMapper objectMapper) {
        this.coursRepository = coursRepository;
        this.coursVersionRepository = coursVersionRepository;
        this.coursPorteeRepository = coursPorteeRepository;
        this.exerciceRepository = exerciceRepository;
        this.exerciceExtractor = exerciceExtractor;
        this.publicationValidator = publicationValidator;
        this.objectMapper = objectMapper;
    }

    /** Create a new draft course. Returns its generated id. */
    @Transactional
    public UUID creerBrouillon(CreerBrouillonCommand cmd) {
        Cours cours = new Cours(
                cmd.auteurId(), cmd.etablissementId(), cmd.titre(),
                cmd.niveauCode(), cmd.matiereCode(), serialize(cmd.content()));
        coursRepository.save(cours);
        return cours.getId();
    }

    /** Overwrite an existing draft's title and content. */
    @Transactional
    public void enregistrerBrouillon(UUID coursId, ModifierBrouillonCommand cmd) {
        Cours cours = coursRepository.findById(coursId)
                .orElseThrow(() -> new CoursIntrouvableException(coursId));
        cours.modifierBrouillon(cmd.titre(), serialize(cmd.content()));
        coursRepository.save(cours);
    }

    /** Replace the set of classes a course is visible to. */
    @Transactional
    public void definirPortees(UUID coursId, Set<UUID> classeIds) {
        if (!coursRepository.existsById(coursId)) {
            throw new CoursIntrouvableException(coursId);
        }
        coursPorteeRepository.deleteByIdCoursId(coursId);
        // Flush the delete before re-inserting so re-adding a class doesn't collide on the PK.
        coursPorteeRepository.flush();
        List<CoursPortee> portees = classeIds.stream()
                .map(classeId -> new CoursPortee(coursId, classeId))
                .toList();
        coursPorteeRepository.saveAll(portees);
    }

    /**
     * Validate the current draft and freeze it as the next immutable version. Exercises get
     * fresh UUIDs and their correction fields are stripped from the stored content. The version
     * row is written before its exercises (FK) and before the course is marked published (FK on
     * {@code version_publiee}).
     */
    @Transactional
    public PublicationResult publier(UUID coursId) {
        Cours cours = coursRepository.findById(coursId)
                .orElseThrow(() -> new CoursIntrouvableException(coursId));

        String brouillon = cours.getBrouillonContent();
        if (brouillon == null || brouillon.isBlank()) {
            throw new InvalidContentException("Cannot publish a course with no draft content: " + coursId);
        }
        JsonNode content = parse(brouillon, coursId);

        publicationValidator.validate(content);

        int version = cours.getVersionPubliee() == null ? 1 : cours.getVersionPubliee() + 1;

        List<Exercice> exercices = new ArrayList<>();
        JsonNode stripped = exerciceExtractor.extractForCoursVersion(content, coursId, version, exercices);

        coursVersionRepository.save(new CoursVersion(coursId, version, serialize(stripped)));
        exerciceRepository.saveAll(exercices);
        cours.marquerPublie(version);
        coursRepository.save(cours);

        return new PublicationResult(coursId, version);
    }

    private String serialize(JsonNode content) {
        if (content == null || content.isNull()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(content);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize course content", e);
        }
    }

    private JsonNode parse(String json, UUID coursId) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            throw new IllegalStateException("Draft content is not valid JSON: " + coursId, e);
        }
    }
}
