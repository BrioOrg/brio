package fr.brio.devoirs.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Corps de la requête de création d'un devoir (l'auteur vient de la session). */
record CreerDevoirRequest(
        @NotNull UUID classeId,
        @NotBlank String titre,
        String consigne,
        @NotBlank String sourceType,
        @NotBlank String sourceRef,
        Integer sourceVersion,
        @NotEmpty List<UUID> exerciceIds,
        @NotNull Instant ouvreAt,
        @NotNull Instant echeanceAt) {}
