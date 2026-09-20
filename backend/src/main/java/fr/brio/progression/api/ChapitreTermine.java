package fr.brio.progression.api;

import java.time.Instant;
import java.util.UUID;

/**
 * Published by progression when a student completes a chapter — all sections read
 * and ≥ 80 % of its exercises solved (ADR 0022). Self-derived: progression is the
 * only module that hears both section reads and submissions, so it owns this event
 * rather than contenu (see ADR 0022 §3, correction du 2026-09-20).
 *
 * Emitted once per (student, chapter); downstream consumers (F4+) can rely on that.
 */
public record ChapitreTermine(
        UUID eleveId,
        String chapitreId,
        Instant survenuLe) {}
