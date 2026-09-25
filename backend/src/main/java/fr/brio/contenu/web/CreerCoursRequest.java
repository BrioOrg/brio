package fr.brio.contenu.web;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Create a teacher-course draft. The author and établissement are derived server-side from the
 * authenticated teacher, never trusted from the client. {@code content} is optional — a course
 * is typically created empty and filled in the editor — and is only validated at publication.
 */
record CreerCoursRequest(
        @NotBlank @Size(max = 300) String titre,
        @NotBlank @Size(max = 16) String niveauCode,
        @NotBlank @Size(max = 64) String matiereCode,
        JsonNode content) {
}
