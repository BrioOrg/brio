package fr.brio.contenu.infrastructure;

import fr.brio.contenu.domain.Exercice;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The owner an exercise block is extracted for. Mirrors the V26 XOR check
 * (chk_exercices_origine): a block belongs either to a catalogue chapter or to a
 * teacher-course version, never both. Making the owner explicit — rather than a
 * nullable {@code chapitreId} — keeps the two origins from blurring, and carries
 * the one behavioural difference that matters: UUID reuse.
 */
sealed interface ExtractionOwner
        permits ExtractionOwner.CatalogueOwner, ExtractionOwner.CoursVersionOwner {

    /**
     * The UUID to mint for the exercise with this slug. Catalogue ingestion reuses the
     * existing UUID so submissions survive re-ingestion (ADR 0010 §3); teacher-course
     * versions are immutable, so every publish mints fresh UUIDs by design.
     */
    UUID uuidFor(String slug);

    Exercice newExercice(UUID id, String slug, String type, String evaluation,
                         List<String> competencies, String difficulte);

    /** Catalogue chapter: reuse UUIDs by natural key {@code (chapitre_id, slug)}. */
    record CatalogueOwner(String chapitreId, Map<String, UUID> existingUuids) implements ExtractionOwner {
        @Override
        public UUID uuidFor(String slug) {
            return existingUuids.getOrDefault(slug, UUID.randomUUID());
        }

        @Override
        public Exercice newExercice(UUID id, String slug, String type, String evaluation,
                                    List<String> competencies, String difficulte) {
            return Exercice.pourChapitre(id, chapitreId, slug, type, evaluation, competencies, difficulte);
        }
    }

    /** Immutable teacher-course version: always a fresh UUID. */
    record CoursVersionOwner(UUID coursId, int version) implements ExtractionOwner {
        @Override
        public UUID uuidFor(String slug) {
            return UUID.randomUUID();
        }

        @Override
        public Exercice newExercice(UUID id, String slug, String type, String evaluation,
                                    List<String> competencies, String difficulte) {
            return Exercice.pourCoursVersion(id, coursId, version, slug, type, evaluation, competencies, difficulte);
        }
    }
}
