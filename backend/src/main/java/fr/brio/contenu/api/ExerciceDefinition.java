package fr.brio.contenu.api;

import java.util.List;
import java.util.UUID;

/**
 * Evaluation data for a single exercise, published for use by the exercices module.
 * Contains only what is needed for grading — no prose, no chapter context.
 */
public record ExerciceDefinition(
        UUID id,
        String type,
        List<String> competencies,
        String evaluationJson
) {}
