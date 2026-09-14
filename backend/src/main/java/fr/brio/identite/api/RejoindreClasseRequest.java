package fr.brio.identite.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RejoindreClasseRequest(
        @NotBlank String code,
        @NotBlank @Size(min = 8, max = 128) String motDePasse,
        @NotBlank @Size(max = 30) String nomAffiche
) {}
