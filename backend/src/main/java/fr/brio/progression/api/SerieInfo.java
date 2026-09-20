package fr.brio.progression.api;

import java.time.LocalDate;

/**
 * Published projection of a student's day streak, safe to return to the client
 * (ADR 0022 §7, #95). Values are the <em>live</em> ones seen today: a streak past
 * the freeze tolerance reads {@code joursConsecutifs = 0}. {@code dernierJourActif}
 * is null while the student has never been active.
 */
public record SerieInfo(
        int joursConsecutifs,
        LocalDate dernierJourActif,
        int gelsRestants,
        boolean actifAujourdhui) {}
