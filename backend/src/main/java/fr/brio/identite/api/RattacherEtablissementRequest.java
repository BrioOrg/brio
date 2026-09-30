package fr.brio.identite.api;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record RattacherEtablissementRequest(@NotNull UUID etablissementId) {}
