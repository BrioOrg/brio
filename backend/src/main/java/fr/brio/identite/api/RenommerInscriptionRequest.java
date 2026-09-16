package fr.brio.identite.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RenommerInscriptionRequest(
        @NotBlank @Size(max = 30) String nomAffiche
) {}
