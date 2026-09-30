package fr.brio.identite.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * A teacher creating their own class. The school year is computed by the server and the
 * principal teacher is the caller — neither is read from the request.
 */
public record CreerMaClasseRequest(
        @NotNull UUID etablissementId,
        @NotBlank @Size(max = 10) String niveauCode,
        @NotBlank @Size(max = 100) String libelle
) {}
