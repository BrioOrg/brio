package fr.brio.exercices;

import fr.brio.exercices.domain.EvaluationResult;
import java.util.UUID;

public record SoumissionResult(UUID soumissionId, EvaluationResult evaluation) {}
