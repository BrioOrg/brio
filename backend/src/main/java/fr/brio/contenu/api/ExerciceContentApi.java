package fr.brio.contenu.api;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Published API for looking up exercise evaluation data.
 * Consumed by the exercices module; never exposes chapter internals.
 */
public interface ExerciceContentApi {

    Optional<ExerciceDefinition> findById(UUID id);

    /**
     * Every version of the same exercise: for a teacher-course exercise, the ids of all its
     * versions (same course, same editor block id — ADR 0050); for a catalogue exercise, itself.
     * Lets exercices tell a first attempt across republications. By default, the exercise alone.
     */
    default List<UUID> versionsDuMemeExercice(UUID id) {
        return List.of(id);
    }
}
