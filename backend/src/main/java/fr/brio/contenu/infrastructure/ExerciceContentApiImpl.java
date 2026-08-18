package fr.brio.contenu.infrastructure;

import fr.brio.contenu.api.ExerciceContentApi;
import fr.brio.contenu.api.ExerciceDefinition;
import fr.brio.contenu.domain.Exercice;
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

    private ExerciceDefinition toDefinition(Exercice exercice) {
        return new ExerciceDefinition(
                exercice.getId(),
                exercice.getType(),
                exercice.getCompetencies(),
                exercice.getEvaluation()
        );
    }
}
