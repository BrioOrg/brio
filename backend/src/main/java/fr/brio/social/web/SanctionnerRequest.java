package fr.brio.social.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;

/**
 * Corps d'une sanction appliquée à un élève. {@code fin} nulle = sans échéance.
 */
record SanctionnerRequest(
        @NotNull UUID compteId,
        @NotNull UUID classeId,
        @NotBlank String type,
        String motif,
        Instant fin) {}
