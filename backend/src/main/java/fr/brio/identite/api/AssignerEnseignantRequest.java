package fr.brio.identite.api;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/** Assigns (or replaces) the principal teacher of a class. */
public record AssignerEnseignantRequest(
        @NotNull UUID enseignantId
) {}
