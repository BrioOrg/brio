package fr.brio.contenu.api;

import java.util.List;
import java.util.UUID;

/**
 * Evaluation data for a single exercise, published for use by the exercices module.
 * Contains only what is needed for grading plus the owning chapter id, which
 * exercices copies onto {@code SoumissionEnregistree} so progression can attribute
 * the submission to a chapter without reaching into contenu (ADR 0022).
 */
public record ExerciceDefinition(
        UUID id,
        String chapitreId,
        String type,
        List<String> competencies,
        String evaluationJson
) {}
