package fr.brio.contenu.web;

import jakarta.validation.constraints.NotNull;
import java.util.Set;
import java.util.UUID;

/** The set of classes a course is visible to. Each must be a class the teacher runs (§8.4). */
record DefinirPorteesRequest(@NotNull Set<UUID> classeIds) {
}
