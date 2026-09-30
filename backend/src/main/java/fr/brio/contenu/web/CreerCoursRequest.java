package fr.brio.contenu.web;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Create a teacher-course draft. The author is the authenticated teacher, never trusted from the
 * client. {@code etablissementId} is only needed when the teacher is attached to several
 * établissements, and is checked against them (ADR 0029 §4). {@code content} is optional — a
 * course is typically created empty and filled in the editor — and is only validated at
 * publication.
 */
record CreerCoursRequest(
        @NotBlank @Size(max = 300) String titre,
        @NotBlank @Size(max = 16) String niveauCode,
        @NotBlank @Size(max = 64) String matiereCode,
        UUID etablissementId,
        JsonNode content) {
}
