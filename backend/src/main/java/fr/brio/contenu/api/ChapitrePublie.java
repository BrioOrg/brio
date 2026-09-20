package fr.brio.contenu.api;

/**
 * Structural fact about a chapter, published by contenu on every ingest run
 * (including no-op re-ingestions) so consumers can build and keep a projection
 * of the published catalogue without reaching into contenu.
 *
 * This is <b>not</b> a per-student event. It carries only what progression needs
 * to enumerate a track and compute completion (ADR 0022): the chapter's position
 * in its {@code (niveauCode, matiereCode)} track, its publication status, and the
 * counts that define "toutes sections + ≥ 80 % des exercices".
 */
public record ChapitrePublie(
        String chapitreId,
        String niveauCode,
        String matiereCode,
        int ordre,
        String statut,
        int totalSections,
        int totalExercices) {}
