package fr.brio.contenu.api;

import java.util.Optional;

/**
 * Published API for reading a chapter's client-facing document.
 * Consumed by the ia module for tutor context; returns a minimal typed
 * document — not the raw JSONB — so consumers have no coupling to contenu's
 * internal storage format.
 */
public interface ChapitreContentApi {

    Optional<ChapitreDocument> findByTriplet(String niveau, String matiere, String slug);
}
