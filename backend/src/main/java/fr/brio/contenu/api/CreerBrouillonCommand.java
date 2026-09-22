package fr.brio.contenu.api;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;

/**
 * Create a new teacher-course draft (ADR 0019). Author and établissement are referenced by ID
 * (ADR 0007); {@code content} is the block document, validated only at publication.
 */
public record CreerBrouillonCommand(
        UUID auteurId,
        UUID etablissementId,
        String titre,
        String niveauCode,
        String matiereCode,
        JsonNode content) {
}
