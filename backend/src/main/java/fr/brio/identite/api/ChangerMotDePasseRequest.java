package fr.brio.identite.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** The student's own password, chosen after a teacher-led reset (ADR 0036 §5). */
public record ChangerMotDePasseRequest(
        @NotBlank @Size(min = 8, max = 128) String nouveauMotDePasse
) {}
