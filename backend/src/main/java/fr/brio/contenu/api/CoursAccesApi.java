package fr.brio.contenu.api;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Published API for scoped access to a teacher course. Lets other modules gate a course action on
 * the student's class membership without reaching into contenu's {@code cours_portees}. Every
 * method applies the one visibility rule of {@code GET /api/cours/{id}}: published, and scoped to
 * at least one of the student's classes (ADR 0019, ADR 0050 §2).
 */
public interface CoursAccesApi {

    /**
     * Whether the course is published and visible to at least one of the given classes, the
     * classes being resolved by the caller (identite's {@code InscriptionsQuery}, by ID, ADR 0007).
     * A draft, or a published course with no intersecting portée, is visible to no one.
     */
    boolean estVisiblePour(UUID coursId, Set<UUID> classesEleve);

    /**
     * Whether the student may act on the course, contenu resolving the student's classes itself.
     * Used by exercices before grading a course exercise (ADR 0050 §3).
     */
    AccesCours accesPourEleve(UUID eleveId, UUID coursId);

    /** Whether the authenticated teacher owns the lesson, including an unpublished draft. */
    boolean estAuteur(UUID coursId, UUID auteurId);

    /** Whether this course currently has a published version. */
    boolean estPublie(UUID coursId);

    /**
     * Current students of the author's taught classes to which the published course is scoped.
     * Values are class display names. Returns no students if the course is not the teacher's.
     */
    Map<UUID, String> elevesDuCoursPourRevue(UUID coursId, UUID auteurId);

    /**
     * Among {@code coursIds}, those the student can open right now, each with the title of its
     * published version (the title the course page shows). contenu resolves the student's classes
     * itself. Read-only; used by progression's web layer to filter « Reprendre » (ADR 0050 §2).
     */
    Map<UUID, String> titresVisiblesPourEleve(UUID eleveId, Set<UUID> coursIds);
}
