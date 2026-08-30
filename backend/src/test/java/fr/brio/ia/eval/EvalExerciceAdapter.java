package fr.brio.ia.eval;

import fr.brio.contenu.api.ExerciceContentApi;
import fr.brio.contenu.api.ExerciceDefinition;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * ExerciceContentApi implementation for the eval harness.
 * Backed by a map populated by EvalChapitreAdapter as it loads chapters.
 */
class EvalExerciceAdapter implements ExerciceContentApi {

    private final Map<UUID, ExerciceDefinition> exerciceMap;

    EvalExerciceAdapter(Map<UUID, ExerciceDefinition> exerciceMap) {
        this.exerciceMap = exerciceMap;
    }

    @Override
    public Optional<ExerciceDefinition> findById(UUID id) {
        return Optional.ofNullable(exerciceMap.get(id));
    }
}
