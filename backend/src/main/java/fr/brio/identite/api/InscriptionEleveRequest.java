package fr.brio.identite.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

// Unknown fields (e.g. "prenom") are rejected globally by spring.jackson.deserialization.fail-on-unknown-properties=true
public record InscriptionEleveRequest(
        @NotBlank @Pattern(regexp = "6e|5e|4e|3e", message = "Niveau invalide") String niveauDeclare,
        @NotBlank @Size(min = 8, max = 128) String motDePasse,
        @NotBlank @Email @Size(max = 200) String emailParent
) {}
