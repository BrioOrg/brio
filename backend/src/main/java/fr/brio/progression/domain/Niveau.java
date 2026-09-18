package fr.brio.progression.domain;

/**
 * Level from cumulative XP — quadratic thresholds (ADR 0022 §5).
 * seuil(n) = 100 · n²  ⇒  niveau = floor( sqrt(xp / 100) ).
 * (100 XP → niveau 1, 400 → 2, 900 → 3, 1600 → 4 …)
 */
public final class Niveau {

    private Niveau() {}

    public static short pour(int xpTotal) {
        if (xpTotal <= 0) return 0;
        return (short) Math.floor(Math.sqrt(xpTotal / 100.0));
    }
}
