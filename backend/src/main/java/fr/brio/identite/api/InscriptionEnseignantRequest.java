package fr.brio.identite.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * Teacher signup. There is no identifiant to choose: the e-mail is the login, so it
 * must fit identifiant_connexion (100 characters). The teacher picks an existing
 * établissement — they never create one (ADR 0029 §1).
 */
public record InscriptionEnseignantRequest(
        @NotBlank @Size(min = 8, max = 128) String motDePasse,
        @NotBlank @Size(max = 200) String nom,
        @NotBlank @Email @Size(max = 100) String email,
        @NotNull UUID etablissementId
) {}
