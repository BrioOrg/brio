package fr.brio.social.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/** Corps de la création d'un salon de classe par un enseignant. */
record CreerSalonRequest(@NotNull UUID classeId, @NotBlank String titre) {}
