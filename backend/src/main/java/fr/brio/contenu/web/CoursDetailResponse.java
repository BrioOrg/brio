package fr.brio.contenu.web;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/**
 * A single teacher course loaded for editing: metadata, the working draft ({@code content},
 * may be null on a freshly created course) and the classes it is currently scoped to. Correction
 * fields are still present here — this is the author's own draft, never a student-facing payload.
 */
record CoursDetailResponse(
        UUID id,
        String titre,
        String niveauCode,
        String matiereCode,
        String statut,
        Integer versionPubliee,
        JsonNode content,
        Set<UUID> classeIds,
        Instant updatedAt) {
}
