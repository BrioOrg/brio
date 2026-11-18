package fr.brio.identite.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RejoindreClasseRequest(
        @NotBlank String code,
        @NotBlank @Size(min = 8, max = MotDePasseHachable.MAX_OCTETS) @MotDePasseHachable String motDePasse,
        @NotBlank @Size(max = 30) String nomAffiche
) {
    /** Never prints the password, the class code or the student's name (ADR 0018 §4). */
    @Override
    public String toString() {
        return "RejoindreClasseRequest[code=***, motDePasse=***, nomAffiche=***]";
    }
}
