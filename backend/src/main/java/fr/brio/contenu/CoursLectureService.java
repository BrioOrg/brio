package fr.brio.contenu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.api.AccesCours;
import fr.brio.contenu.api.SectionCoursLue;
import fr.brio.contenu.domain.Cours;
import fr.brio.contenu.domain.CoursVersionId;
import fr.brio.contenu.infrastructure.CoursPorteeRepository;
import fr.brio.contenu.infrastructure.CoursRepository;
import fr.brio.contenu.infrastructure.CoursVersionRepository;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads a <b>published</b> teacher course for a student (ADR 0019 §1 — "deux origines,
 * un moteur"). The served content is the immutable {@code cours_versions.content}, already
 * stripped of correction fields at publish time, so it is the exact same client-facing
 * shape as a catalogue chapter — {@code <ChapterView/>} renders it identically (§8.6).
 *
 * Access is scoped: a course is visible only to students of a class it has been "portée" to
 * ({@code cours_portees}). The student's classes are resolved by the caller (via identite's
 * {@code InscriptionsQuery}) and passed in — this service never reaches into identite.
 */
@Service
public class CoursLectureService {

    private final CoursRepository coursRepository;
    private final CoursVersionRepository coursVersionRepository;
    private final CoursPorteeRepository coursPorteeRepository;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher events;

    CoursLectureService(
            CoursRepository coursRepository,
            CoursVersionRepository coursVersionRepository,
            CoursPorteeRepository coursPorteeRepository,
            ObjectMapper objectMapper,
            ApplicationEventPublisher events) {
        this.coursRepository = coursRepository;
        this.coursVersionRepository = coursVersionRepository;
        this.coursPorteeRepository = coursPorteeRepository;
        this.objectMapper = objectMapper;
        this.events = events;
    }

    /**
     * The client-facing JSON of the course's currently published version, or empty when the
     * course does not exist or has no published version (→ 404). Never carries correction data.
     */
    @Transactional(readOnly = true)
    public Optional<JsonNode> contenuPublie(UUID coursId) {
        return versionPubliee(coursId).map(content -> parse(content, coursId));
    }

    /**
     * Whether the course is published and visible to at least one of the given classes.
     * A draft (no published version) is visible to no one; a published course with no
     * intersecting portée is visible to no one.
     */
    @Transactional(readOnly = true)
    public boolean estVisiblePour(UUID coursId, Set<UUID> classesEleve) {
        if (classesEleve.isEmpty() || versionPubliee(coursId).isEmpty()) {
            return false;
        }
        return coursPorteeRepository.findByIdCoursId(coursId).stream()
                .anyMatch(p -> classesEleve.contains(p.getClasseId()));
    }

    /**
     * The access outcome of {@code GET /api/cours/{id}} for these classes: not found (no published
     * version), out of scope, or visible. The visibility half is {@link #estVisiblePour} itself, so
     * every caller applies the one rule (ADR 0050 §2, S3).
     */
    @Transactional(readOnly = true)
    public AccesCours acces(UUID coursId, Set<UUID> classesEleve) {
        if (versionPubliee(coursId).isEmpty()) {
            return AccesCours.INTROUVABLE;
        }
        return estVisiblePour(coursId, classesEleve) ? AccesCours.VISIBLE : AccesCours.HORS_PORTEE;
    }

    /**
     * Among {@code coursIds}, those visible to the given classes ({@link #estVisiblePour}), each
     * with the title of its published version — the title the course page shows, not the draft's
     * (ADR 0050 §2, S1).
     */
    @Transactional(readOnly = true)
    public Map<UUID, String> titresVisibles(Set<UUID> coursIds, Set<UUID> classesEleve) {
        Map<UUID, String> titres = new LinkedHashMap<>();
        if (classesEleve.isEmpty()) {
            return titres;
        }
        for (UUID coursId : coursIds) {
            if (estVisiblePour(coursId, classesEleve)) {
                contenuPublie(coursId).ifPresent(c -> titres.put(coursId, c.path("title").asText()));
            }
        }
        return titres;
    }

    /** Whether the currently published version of the course has this section. */
    @Transactional(readOnly = true)
    public boolean sectionPubliee(UUID coursId, String sectionId) {
        return contenuPublie(coursId).map(c -> CoursStructure.contientSection(c, sectionId)).orElse(false);
    }

    /**
     * Records that a student read a section of a teacher course by publishing
     * {@link SectionCoursLue} (ADR 0050 §1), after the same checks as reading the course: not
     * found (no published version, or the section is not in it) or out of scope publish nothing.
     */
    // The transaction is what carries the event: progression listens after commit (#252).
    @Transactional
    public AccesCours marquerSectionLue(UUID coursId, String sectionId, UUID eleveId, Set<UUID> classesEleve) {
        AccesCours acces = acces(coursId, classesEleve);
        if (acces != AccesCours.VISIBLE) {
            return acces;
        }
        if (!sectionPubliee(coursId, sectionId)) {
            return AccesCours.INTROUVABLE;
        }
        events.publishEvent(new SectionCoursLue(eleveId, coursId, sectionId, Instant.now()));
        return AccesCours.VISIBLE;
    }

    /**
     * The published courses visible to at least one of the given classes, most recently
     * published first — a student's course list. Same rule as {@link #estVisiblePour}: a
     * draft or a course with no intersecting portée is never listed. A course scoped to
     * several of the student's classes appears once.
     */
    @Transactional(readOnly = true)
    public List<CoursVisible> coursVisiblesPour(Set<UUID> classesEleve) {
        if (classesEleve.isEmpty()) {
            return List.of();
        }
        Map<UUID, List<UUID>> classesParCours = coursPorteeRepository.findByIdClasseIdIn(classesEleve).stream()
                .collect(Collectors.groupingBy(
                        p -> p.getCoursId(),
                        Collectors.mapping(p -> p.getClasseId(), Collectors.toList())));
        return coursRepository.findAllById(classesParCours.keySet()).stream()
                .filter(c -> Cours.STATUT_PUBLIE.equals(c.getStatut()) && c.getVersionPubliee() != null)
                .flatMap(c -> coursVersionRepository.findById(new CoursVersionId(c.getId(), c.getVersionPubliee()))
                        .map(v -> new CoursVisible(c.getId(), c.getTitre(), c.getNiveauCode(),
                                c.getMatiereCode(), c.getAuteurId(), v.getPublieAt(),
                                classesParCours.get(c.getId())))
                        .stream())
                .sorted(Comparator.comparing(CoursVisible::publieAt).reversed())
                .toList();
    }

    private Optional<String> versionPubliee(UUID coursId) {
        return coursRepository.findById(coursId)
                .filter(c -> Cours.STATUT_PUBLIE.equals(c.getStatut()) && c.getVersionPubliee() != null)
                .flatMap(c -> coursVersionRepository.findById(new CoursVersionId(coursId, c.getVersionPubliee())))
                .map(v -> v.getContent());
    }

    private JsonNode parse(String json, UUID coursId) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            throw new IllegalStateException("Stored course version content is not valid JSON: " + coursId, e);
        }
    }
}
