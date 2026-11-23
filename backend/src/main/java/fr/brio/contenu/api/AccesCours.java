package fr.brio.contenu.api;

/**
 * Whether a student may act on a teacher course (ADR 0050 §3): the same outcome as reading it on
 * {@code GET /api/cours/{id}} — {@link #INTROUVABLE} (404) when the course does not exist or has
 * no published version, {@link #HORS_PORTEE} (403) when it is not scoped to any of the student's
 * classes, {@link #VISIBLE} otherwise.
 */
public enum AccesCours {
    VISIBLE,
    HORS_PORTEE,
    INTROUVABLE
}
