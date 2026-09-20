package fr.brio.progression.domain;

import java.util.OptionalInt;

/**
 * Mastery level (0–4) from a difficulty-weighted success rate over a sample of submissions
 * (ADR 0022 §6, mise en œuvre #103).
 *
 * <p>Each submission contributes {@code score · poids(difficulté)} to the numerator and
 * {@code poids(difficulté)} to the denominator, so {@code taux = Σ(score·poids) / Σ(poids)}
 * stays in [0, 1] and {@code niveau = clamp(floor(taux · 5), 0, 4)} keeps the same mapping
 * (0.8 lands on 4). Succeeding on an {@code approfondissement} exercise counts three times an
 * {@code introduction} toward the ceiling; partial credit (score in [0, 1]) now counts too.
 *
 * <p>Below {@link #SEUIL_ECHANTILLON} <em>submissions</em> (an unweighted row count) the level
 * is <em>absent</em>: one good answer would otherwise read "maîtrisé" and a teacher seeing
 * level 4 off a single question loses trust — the product rule forbids showing a value the
 * backend does not really have.
 */
public final class NiveauMaitrise {

    /** Fewest submissions before a level is reported at all. Tunable (ADR 0022 §6). */
    public static final int SEUIL_ECHANTILLON = 3;

    /** Sliding window: the level reflects the N most recent first attempts. */
    public static final int FENETRE = 10;

    private NiveauMaitrise() {}

    /**
     * Difficulty weight for one exercise band (ADR 0022 §6): introduction 1, standard 2,
     * approfondissement 3. Any other value — including {@code null} (legacy submissions or a
     * block that omits difficulty) or an unknown band from the open enum — is weighted as
     * standard, the median, so it neither penalises nor favours untagged content.
     */
    public static double poids(String difficulte) {
        if (difficulte == null) {
            return 2.0;
        }
        return switch (difficulte) {
            case "introduction" -> 1.0;
            case "approfondissement" -> 3.0;
            default -> 2.0; // "standard" and any unknown band
        };
    }

    /**
     * Level in [0, 4] from the weighted sums, or empty when the sample is below
     * {@link #SEUIL_ECHANTILLON}. {@code echantillon} is the unweighted submission count (the
     * honesty gate); {@code sommeSignal = Σ(score·poids)} and {@code sommePoids = Σ(poids)}.
     */
    public static OptionalInt pour(double sommeSignal, double sommePoids, int echantillon) {
        if (echantillon < SEUIL_ECHANTILLON) {
            return OptionalInt.empty();
        }
        double taux = sommePoids <= 0 ? 0 : sommeSignal / sommePoids;
        int niveau = (int) Math.floor(taux * 5);
        return OptionalInt.of(Math.max(0, Math.min(4, niveau)));
    }
}
