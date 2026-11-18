package fr.brio.identite.api;

/**
 * Which kind of adult reset a student's access (ADR 0036 §8): told to the student, never who by
 * name. Stored as its name in {@code identite.comptes.acces_reinitialise_par} (V43 constraint).
 */
public enum ReinitialisePar {
    /** The teacher of one of the student's classes. */
    enseignant,
    /** The brio team, through a class or outside any class (ADR 0036 §1bis). */
    admin_brio
}
