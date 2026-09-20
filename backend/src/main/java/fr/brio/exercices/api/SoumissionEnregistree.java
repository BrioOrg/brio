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
 * après erreur" (ADR 0022 barème), and lets mastery count first attempts only so
 * redoing an exercise cannot flood the sample, without storing attempt state itself.
 *
 * `chapitreId` is the owning chapter (copied from the exercise definition) so
 * progression can attribute the solve to a chapter for completion tracking
 * without calling contenu (ADR 0022). It may be null for legacy submissions.
 *
 * `soumissionId` is the persisted submission's id — a stable idempotency key so a
 * redelivered event (Spring Modulith replays after a crash) records the submission
 * once in progression's mastery projection rather than skewing the sample (ADR 0022 §6).
 *
 * `score` is the graded fraction in [0, 1] (1.0 = fully correct). Mastery is derived
 * from `correct` in v1 but the score is carried and stored now: history that was
 * never captured cannot be recomputed if the formula later becomes score-based.
 */
public record SoumissionEnregistree(
        UUID eleveId,
        UUID exerciceId,
        UUID soumissionId,
        String chapitreId,
        boolean correct,
        double score,
        boolean premiereTentative,
        List<String> competencies,
        Instant submittedAt) {

    public SoumissionEnregistree {
        competencies = competencies != null ? List.copyOf(competencies) : List.of();
    }
}
