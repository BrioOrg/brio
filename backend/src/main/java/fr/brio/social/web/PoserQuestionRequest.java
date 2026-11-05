package fr.brio.social.web;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Une nouvelle question. {@code matiere} est facultative : mathématiques par défaut. */
record PoserQuestionRequest(@NotBlank String titre, @NotNull JsonNode corps, String matiere) {}
