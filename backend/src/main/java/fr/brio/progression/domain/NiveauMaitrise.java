package fr.brio.progression.domain;

import java.util.OptionalInt;

/**
 * Mastery level (0–4) from the success rate over a sample of submissions (ADR 0022 §6).
 *
 * <p>{@code niveau = clamp(floor(rate · 5), 0, 4)} with {@code rate = reussites / echantillon}
 * (0.8 lands on 4, as intended). Below {@link #SEUIL_ECHANTILLON} submissions the level is
 * <em>absent</em>: one correct answer would otherwise read "maîtrisé" and a teacher seeing
 * level 4 off a single question loses trust — and the product rule forbids showing a value
 * the backend does not really have. v1 is binary (from {@code correct}); the weighting by
 * exercise difficulty is deferred (difficulty is carried by no backend layer today).
 */
public final class NiveauMaitrise {

    /** Fewest submissions before a level is reported at all. Tunable (ADR 0022 §6). */
    public static final int SEUIL_ECHANTILLON = 3;

    /** Sliding window: the level reflects the N most recent first attempts. */
    public static final int FENETRE = 10;

    private NiveauMaitrise() {}

    /** Level in [0, 4], or empty when the sample is below {@link #SEUIL_ECHANTILLON}. */
    public static OptionalInt pour(int reussites, int echantillon) {
        if (echantillon < SEUIL_ECHANTILLON) {
            return OptionalInt.empty();
        }
        double rate = (double) reussites / echantillon;
        int niveau = (int) Math.floor(rate * 5);
        return OptionalInt.of(Math.max(0, Math.min(4, niveau)));
    }
}
