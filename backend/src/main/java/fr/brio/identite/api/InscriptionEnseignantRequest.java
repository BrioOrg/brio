package fr.brio.identite.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InscriptionEnseignantRequest(
        @NotBlank @Size(min = 3, max = 100) String identifiantConnexion,
        @NotBlank @Size(min = 8, max = 128) String motDePasse,
        @NotBlank @Size(max = 200) String nom,
        @NotBlank @Email @Size(max = 200) String email
) {}
