package fr.brio.contenu.infrastructure;

import fr.brio.contenu.api.ExerciceContentApi;
import fr.brio.contenu.api.ExerciceDefinition;
import fr.brio.contenu.domain.Exercice;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
class ExerciceContentApiImpl implements ExerciceContentApi {

    private final ExerciceRepository exerciceRepository;

    ExerciceContentApiImpl(ExerciceRepository exerciceRepository) {
        this.exerciceRepository = exerciceRepository;
    }

    @Override
    public Optional<ExerciceDefinition> findById(UUID id) {
        return exerciceRepository.findById(id).map(this::toDefinition);
    }

    @Override
    public List<UUID> versionsDuMemeExercice(UUID id) {
        return exerciceRepository.findById(id)
                .map(e -> e.getCoursId() == null
                        ? List.of(e.getId())
                        : exerciceRepository.findByCoursIdAndSlug(e.getCoursId(), e.getSlug()).stream()
                                .map(Exercice::getId)
                                .toList())
                .orElse(List.of(id));
    }

    private ExerciceDefinition toDefinition(Exercice exercice) {
        return new ExerciceDefinition(
                exercice.getId(),
                exercice.getChapitreId(),
                exercice.getType(),
                exercice.getCompetencies(),
                exercice.getDifficulte(),
                exercice.getEvaluation(),
                exercice.getCoursId(),
                exercice.getCoursId() != null ? exercice.getSlug() : null
        );
    }
}
