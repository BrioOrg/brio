package fr.brio.social.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/** Corps de la création d'un fil d'entraide. */
record OuvrirFilRequest(
        @NotBlank String portee,
        @NotBlank String porteeRef,
        @NotNull UUID classeId,
        @NotBlank String titre,
        @NotBlank String question) {}
