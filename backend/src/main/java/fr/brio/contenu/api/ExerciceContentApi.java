package fr.brio.contenu.api;

import java.util.Optional;
import java.util.UUID;

/**
 * Published API for looking up exercise evaluation data.
 * Consumed by the exercices module; never exposes chapter internals.
 */
public interface ExerciceContentApi {

    Optional<ExerciceDefinition> findById(UUID id);
}
