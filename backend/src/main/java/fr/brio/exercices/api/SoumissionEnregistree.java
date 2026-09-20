package fr.brio.exercices.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Published when a student's submission has been recorded and evaluated.
 *
 * This is the exercices module's contract with the rest of the system (notably
 * `progression`, which derives XP and mastery from it). Consumers reference the
 * student and exercise by ID only (ADR 0007) and never reach into exercices.
 *
 * `premiereTentative` is true when this was the student's first attempt at the
 * exercise — it lets progression tell "réussi du premier coup" from "réussi
 * après erreur" (ADR 0022 barème) without storing attempt state itself.
 *
 * `chapitreId` is the owning chapter (copied from the exercise definition) so
 * progression can attribute the solve to a chapter for completion tracking
 * without calling contenu (ADR 0022). It may be null for legacy submissions.
 */
public record SoumissionEnregistree(
        UUID eleveId,
        UUID exerciceId,
        String chapitreId,
        boolean correct,
        boolean premiereTentative,
        List<String> competencies,
        Instant submittedAt) {

    public SoumissionEnregistree {
        competencies = competencies != null ? List.copyOf(competencies) : List.of();
    }
}
