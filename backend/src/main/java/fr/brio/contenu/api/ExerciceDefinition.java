package fr.brio.contenu.api;

import java.util.List;
import java.util.UUID;

/**
 * Evaluation data for a single exercise, published for use by the exercices module.
 * Contains only what is needed for grading plus the owning chapter id, which
 * exercices copies onto {@code SoumissionEnregistree} so progression can attribute
 * the submission to a chapter without reaching into contenu (ADR 0022).
 *
 * {@code difficulte} is the coarse difficulty band (open enum, may be null when the block
 * omits it), likewise copied onto the event so progression can weight mastery by difficulty
 * without calling contenu (ADR 0022 §6).
 */
public record ExerciceDefinition(
        UUID id,
        String chapitreId,
        String type,
        List<String> competencies,
        String difficulte,
        String evaluationJson
) {}
