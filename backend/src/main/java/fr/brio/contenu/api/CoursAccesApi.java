package fr.brio.contenu.api;

import java.util.Set;
import java.util.UUID;

/**
 * Published API for scoped access to a teacher course. Lets other modules (the ia tutor)
 * gate a course action on the student's class membership without reaching into contenu's
 * {@code cours_portees}. The student's classes are resolved by the caller (identite's
 * {@code InscriptionsQuery}) and passed by ID (ADR 0007).
 */
public interface CoursAccesApi {

    /**
     * Whether the course is published and visible to at least one of the given classes.
     * A draft, or a published course with no intersecting portée, is visible to no one.
     */
    boolean estVisiblePour(UUID coursId, Set<UUID> classesEleve);
}
