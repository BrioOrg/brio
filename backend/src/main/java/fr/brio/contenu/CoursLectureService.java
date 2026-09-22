package fr.brio.contenu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.domain.Cours;
import fr.brio.contenu.domain.CoursVersionId;
import fr.brio.contenu.infrastructure.CoursPorteeRepository;
import fr.brio.contenu.infrastructure.CoursRepository;
import fr.brio.contenu.infrastructure.CoursVersionRepository;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
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

    CoursLectureService(
            CoursRepository coursRepository,
            CoursVersionRepository coursVersionRepository,
            CoursPorteeRepository coursPorteeRepository,
            ObjectMapper objectMapper) {
        this.coursRepository = coursRepository;
        this.coursVersionRepository = coursVersionRepository;
        this.coursPorteeRepository = coursPorteeRepository;
        this.objectMapper = objectMapper;
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
