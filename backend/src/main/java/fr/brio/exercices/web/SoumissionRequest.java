package fr.brio.exercices.web;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotNull;

record SoumissionRequest(@NotNull JsonNode answer) {}
