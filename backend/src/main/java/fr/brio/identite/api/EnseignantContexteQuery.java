package fr.brio.identite.api;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Published query port for a teacher's authoring context. Other modules reference teachers,
 * classes and établissements by ID only (ADR 0007) — this is how {@code contenu} answers
 * "which établissement does this teacher author for?" and "which classes may a course be
 * scoped to?" without reaching into identite's internals.
 *
 * <p>A teacher has no direct établissement column; both facets are derived from the active
 * classes they are the {@code enseignant_principal} of.
 */
public interface EnseignantContexteQuery {

    /**
     * The IDs of the active classes the given account is the principal teacher of. Empty when
     * the teacher runs no class. These are the only classes a course may be scoped to. Never
     * {@code null}.
     */
    Set<UUID> classesEnseignees(UUID compteId);

    /**
     * The teacher's établissement, derived from their active classes. Empty when the teacher
     * runs no class, or (defensively) when their classes span more than one établissement —
     * in both cases the caller cannot unambiguously attribute a new course. Never {@code null}.
     */
    Optional<UUID> etablissementDeLEnseignant(UUID compteId);
}
