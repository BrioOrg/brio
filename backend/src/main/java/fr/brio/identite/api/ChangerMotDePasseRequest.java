package fr.brio.identite.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** The student's own password, chosen after a teacher-led reset (ADR 0036 §5). */
public record ChangerMotDePasseRequest(
        @NotBlank @Size(min = 8, max = 128) String nouveauMotDePasse
) {
    /** Never prints the password: a record's default toString would put it in any log line. */
    @Override
    public String toString() {
        return "ChangerMotDePasseRequest[nouveauMotDePasse=***]";
    }
}
