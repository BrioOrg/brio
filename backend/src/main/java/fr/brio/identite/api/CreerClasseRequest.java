package fr.brio.identite.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreerClasseRequest(
        @NotNull UUID etablissementId,
        @NotBlank @Size(max = 10) String niveauCode,
        @NotBlank @Size(max = 100) String libelle,
        @NotBlank @Pattern(regexp = "\\d{4}-\\d{4}") String anneeScolaire,
        // Optional at creation: a class may be assigned a principal teacher later (PUT .../enseignant-principal)
        UUID enseignantPrincipalId
) {}
