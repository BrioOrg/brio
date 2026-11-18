package fr.brio.identite.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RejoindreClasseRequest(
        @NotBlank String code,
        @NotBlank @Size(min = 8) @MotDePasseHachable String motDePasse,
        @NotBlank @Size(max = 30) String nomAffiche
) {
    /** Never prints the password nor the class code: either would let someone in. */
    @Override
    public String toString() {
        return "RejoindreClasseRequest[code=***, motDePasse=***, nomAffiche=" + nomAffiche + "]";
    }
}
