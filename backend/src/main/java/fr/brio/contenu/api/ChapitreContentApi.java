package fr.brio.contenu.api;

import java.util.Optional;
import java.util.UUID;

/**
 * Published API for reading a chapter's client-facing document.
 * Consumed by the ia module for tutor context; returns a minimal typed
 * document — not the raw JSONB — so consumers have no coupling to contenu's
 * internal storage format.
 *
 * <p>The same typed document resolves from either origin (ADR 0019 §1): a catalogue
 * chapter ({@link #findByTriplet}) or a published teacher-course version
 * ({@link #findCoursVersionPubliee}). The tutor runs unchanged on both.
 */
public interface ChapitreContentApi {

    Optional<ChapitreDocument> findByTriplet(String niveau, String matiere, String slug);

    /**
     * The typed document of the course's currently published version, or empty when the
     * course does not exist or has no published version. Does <b>not</b> enforce portée
     * access — callers gate that separately via {@link CoursAccesApi}.
     */
    Optional<ChapitreDocument> findCoursVersionPubliee(UUID coursId);
}
