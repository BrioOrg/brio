package fr.brio.identite.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Teacher signup. There is no identifiant to choose: the e-mail is the login, so it
 * must fit identifiant_connexion (100 characters).
 */
public record InscriptionEnseignantRequest(
        @NotBlank @Size(min = 8, max = 128) String motDePasse,
        @NotBlank @Size(max = 200) String nom,
        @NotBlank @Email @Size(max = 100) String email
) {}
