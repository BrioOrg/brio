package fr.brio.identite.api;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Published query port for a teacher's authoring context. Other modules reference teachers,
 * classes and établissements by ID only (ADR 0007) — this is how {@code contenu} answers
 * "which établissement does this teacher author for?" and "which classes may a course be
 * scoped to?" without reaching into identite's internals.
 *
 * <p>A teacher's classes are the active ones they are the {@code enseignant_principal} of;
 * their établissements are the ones they are attached to, with or without a class there
 * (ADR 0029 §2).
 */
public interface EnseignantContexteQuery {

    /**
     * The IDs of the active classes the given account is the principal teacher of. Empty when
     * the teacher runs no class. These are the only classes a course may be scoped to. Never
     * {@code null}.
     */
    Set<UUID> classesEnseignees(UUID compteId);

    /**
     * The IDs of the établissements the given teacher is attached to. A replacement teacher has
     * several, so a caller attributing a new course must ask which one when there is more than
     * one. Empty for an account attached to none. Never {@code null}.
     */
    Set<UUID> etablissementsDeLEnseignant(UUID compteId);

    /**
     * Display names of the given teacher accounts, keyed by account ID — how a student's
     * course list shows who wrote each course. Only accounts that are teachers and have a name
     * appear; any other ID is simply absent (never a student's name). One lookup for the whole
     * set. Never {@code null}.
     */
    Map<UUID, String> nomsDesEnseignants(Set<UUID> compteIds);
}
