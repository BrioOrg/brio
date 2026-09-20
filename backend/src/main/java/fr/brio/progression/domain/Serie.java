package fr.brio.progression.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.IsoFields;
import java.util.UUID;

/**
 * A student's day streak (ADR 0022 §7, decisions #95). One row per student, driven
 * by activity events (a submission — right or wrong — or a section read).
 *
 * <p>A weekly « gel » (freeze) tolerates <b>one</b> missed day per ISO week
 * (Europe/Paris): {@code gelsRestants} refills to {@link #GELS_PAR_SEMAINE} at each
 * new ISO week and is consumed to bridge a single-day gap. Two missed days in a
 * row — or a gap with no freeze left — reset the streak. The streak is never
 * bought: it carries no XP, it is only shown.
 *
 * <p>Both the write ({@link #enregistrerActivite}) and the read-time decay
 * ({@link #joursConsecutifsAu} & co.) live here as pure functions so the mechanic
 * is unit-testable without a database, and so a stale streak reads its true value
 * (0 once broken) without needing a write.
 */
@Entity
@Table(name = "series", schema = "progression")
public class Serie {

    /** Missed days tolerated per ISO week before the streak breaks. */
    public static final short GELS_PAR_SEMAINE = 1;

    @Id
    @Column(name = "eleve_id")
    private UUID eleveId;

    @Column(name = "jours_consecutifs", nullable = false)
    private short joursConsecutifs;

    @Column(name = "dernier_jour_actif")
    private LocalDate dernierJourActif;

    @Column(name = "gels_restants", nullable = false)
    private short gelsRestants;

    @Column(name = "maj_at", nullable = false)
    private Instant majAt;

    protected Serie() {}

    public Serie(UUID eleveId) {
        this.eleveId = eleveId;
        this.joursConsecutifs = 0;
        this.dernierJourActif = null;
        this.gelsRestants = GELS_PAR_SEMAINE;
        this.majAt = Instant.now();
    }

    /**
     * Records activity on {@code jour}. Idempotent within a day and immune to
     * out-of-order past events (a day at or before the last active day is a no-op).
     * Advancing to a later day extends, freezes, or resets the streak per the gel
     * rules above.
     */
    public void enregistrerActivite(LocalDate jour, Instant quand) {
        if (dernierJourActif == null) {
            joursConsecutifs = 1;
            dernierJourActif = jour;
            majAt = quand;
            return;
        }
        if (!jour.isAfter(dernierJourActif)) {
            return; // same day already counted, or a stale earlier event
        }
        if (!memeSemaineIso(dernierJourActif, jour)) {
            gelsRestants = GELS_PAR_SEMAINE; // fresh weekly allowance
        }
        long ecart = ChronoUnit.DAYS.between(dernierJourActif, jour);
        if (ecart == 1) {
            joursConsecutifs++;
        } else if (ecart == 2 && gelsRestants >= 1) {
            joursConsecutifs++;
            gelsRestants--; // bridge the single missed day
        } else {
            joursConsecutifs = 1; // broken — start over from today
        }
        dernierJourActif = jour;
        majAt = quand;
    }

    /** Live streak length seen on {@code aujourdhui}: 0 once the streak is broken. */
    public int joursConsecutifsAu(LocalDate aujourdhui) {
        if (dernierJourActif == null) {
            return 0;
        }
        return estVivanteAu(aujourdhui) ? joursConsecutifs : 0;
    }

    /** Freeze allowance seen on {@code aujourdhui}, reflecting the weekly refill. */
    public int gelsRestantsAu(LocalDate aujourdhui) {
        if (dernierJourActif == null || memeSemaineIso(dernierJourActif, aujourdhui)) {
            return gelsRestants;
        }
        return GELS_PAR_SEMAINE;
    }

    /** Whether the student was already active today. */
    public boolean estActifAu(LocalDate aujourdhui) {
        return aujourdhui.equals(dernierJourActif);
    }

    /**
     * Whether the streak is still alive on {@code aujourdhui} — i.e. activity today
     * would extend it rather than restart it. Mirrors the write-path gel rules.
     */
    private boolean estVivanteAu(LocalDate aujourdhui) {
        if (dernierJourActif == null || aujourdhui.isBefore(dernierJourActif)) {
            return true; // active today/future-relative event: nothing has decayed yet
        }
        long ecart = ChronoUnit.DAYS.between(dernierJourActif, aujourdhui);
        int gelDispo = gelsRestantsAu(aujourdhui);
        return ecart <= 1 || (ecart == 2 && gelDispo >= 1);
    }

    private static boolean memeSemaineIso(LocalDate a, LocalDate b) {
        return a.get(IsoFields.WEEK_BASED_YEAR) == b.get(IsoFields.WEEK_BASED_YEAR)
                && a.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR) == b.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
    }

    public UUID getEleveId() { return eleveId; }
    public short getJoursConsecutifs() { return joursConsecutifs; }
    public LocalDate getDernierJourActif() { return dernierJourActif; }
    public short getGelsRestants() { return gelsRestants; }
    public Instant getMajAt() { return majAt; }
}
