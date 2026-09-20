package fr.brio.progression.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Pure streak mechanics (ADR 0022 §7, decisions #95). Dates are chosen against a
 * real calendar: 2026-09-14…20 are ISO week 38 (Mon–Sun), 2026-09-21 is week 39.
 */
class SerieTest {

    private final UUID eleve = UUID.randomUUID();

    private static final LocalDate MON_W38 = LocalDate.of(2026, 9, 14);
    private static final LocalDate TUE_W38 = LocalDate.of(2026, 9, 15);
    private static final LocalDate WED_W38 = LocalDate.of(2026, 9, 16);
    private static final LocalDate THU_W38 = LocalDate.of(2026, 9, 17);
    private static final LocalDate FRI_W38 = LocalDate.of(2026, 9, 18);
    private static final LocalDate SAT_W38 = LocalDate.of(2026, 9, 19);
    private static final LocalDate MON_W39 = LocalDate.of(2026, 9, 21);

    private Serie serie() {
        return new Serie(eleve);
    }

    private static void actif(Serie s, LocalDate jour) {
        s.enregistrerActivite(jour, jour.atStartOfDay(java.time.ZoneOffset.UTC).toInstant());
    }

    // ── write path ────────────────────────────────────────────────────────────

    @Test
    void premiereActiviteDemarreLaSerieAUn() {
        Serie s = serie();
        actif(s, MON_W38);
        assertThat(s.getJoursConsecutifs()).isEqualTo((short) 1);
        assertThat(s.getDernierJourActif()).isEqualTo(MON_W38);
        assertThat(s.getGelsRestants()).isEqualTo(Serie.GELS_PAR_SEMAINE);
    }

    @Test
    void joursConsecutifsSAdditionnent() {
        Serie s = serie();
        actif(s, MON_W38);
        actif(s, TUE_W38);
        actif(s, WED_W38);
        assertThat(s.getJoursConsecutifs()).isEqualTo((short) 3);
    }

    @Test
    void memeJourNeCompteQuUneFois() {
        Serie s = serie();
        actif(s, MON_W38);
        actif(s, MON_W38);
        assertThat(s.getJoursConsecutifs()).isEqualTo((short) 1);
    }

    @Test
    void evenementPasseEstIgnore() {
        Serie s = serie();
        actif(s, WED_W38);
        actif(s, MON_W38); // out-of-order, earlier than the last active day
        assertThat(s.getJoursConsecutifs()).isEqualTo((short) 1);
        assertThat(s.getDernierJourActif()).isEqualTo(WED_W38);
    }

    @Test
    void unJourManqueEstComblerParLeGel() {
        Serie s = serie();
        actif(s, MON_W38);
        actif(s, WED_W38); // Tuesday missed — bridged by the weekly freeze
        assertThat(s.getJoursConsecutifs()).isEqualTo((short) 2);
        assertThat(s.getGelsRestants()).isEqualTo((short) 0);
    }

    @Test
    void deuxTrousLaMemeSemaineReinitialisent() {
        Serie s = serie();
        actif(s, MON_W38);
        actif(s, WED_W38); // first gap: gel consumed
        actif(s, FRI_W38); // second gap same week: no gel left → reset
        assertThat(s.getJoursConsecutifs()).isEqualTo((short) 1);
    }

    @Test
    void unTrouDeDeuxJoursReinitialiseMemeAvecGel() {
        Serie s = serie();
        actif(s, MON_W38);
        actif(s, THU_W38); // gap of 3 days: a freeze bridges only one → reset
        assertThat(s.getJoursConsecutifs()).isEqualTo((short) 1);
        assertThat(s.getGelsRestants()).isEqualTo(Serie.GELS_PAR_SEMAINE);
    }

    @Test
    void leGelSeRechargeAChaqueNouvelleSemaineIso() {
        Serie s = serie();
        actif(s, THU_W38);
        actif(s, SAT_W38); // gap: week-38 gel consumed → jours 2, gels 0
        assertThat(s.getGelsRestants()).isEqualTo((short) 0);

        actif(s, MON_W39); // gap into week 39: gel refilled, bridges again
        assertThat(s.getJoursConsecutifs()).isEqualTo((short) 3);
        assertThat(s.getGelsRestants()).isEqualTo((short) 0);
    }

    // ── read-time decay ─────────────────────────────────────────────────────────

    @Test
    void serieVivanteRenvoieSaLongueur() {
        Serie s = serie();
        actif(s, MON_W38);
        actif(s, TUE_W38);
        actif(s, WED_W38); // streak 3, last active Wed, gel intact
        assertThat(s.joursConsecutifsAu(WED_W38)).isEqualTo(3); // active today
        assertThat(s.joursConsecutifsAu(THU_W38)).isEqualTo(3); // yesterday
        assertThat(s.joursConsecutifsAu(FRI_W38)).isEqualTo(3); // one missed day, gel covers
    }

    @Test
    void serieRompueRenvoieZeroSansEcriture() {
        Serie s = serie();
        actif(s, MON_W38);
        actif(s, TUE_W38);
        actif(s, WED_W38);
        // Two missed days (Thu, Fri) with only one freeze → broken by Saturday.
        assertThat(s.joursConsecutifsAu(SAT_W38)).isEqualTo(0);
        // Stored value is untouched: decay is read-only.
        assertThat(s.getJoursConsecutifs()).isEqualTo((short) 3);
    }

    @Test
    void gelDejaConsommeNeSauvePasLaLecture() {
        Serie s = serie();
        actif(s, MON_W38);
        actif(s, WED_W38); // gel spent bridging Tuesday; last active Wed, gels 0
        assertThat(s.joursConsecutifsAu(FRI_W38)).isEqualTo(0); // gap 2 same week, no gel
    }

    @Test
    void refillDeSemaineGardeLaSerieVivanteALaLecture() {
        Serie s = serie();
        actif(s, THU_W38);
        actif(s, SAT_W38); // gel spent in week 38; last active Sat, gels 0
        assertThat(s.joursConsecutifsAu(MON_W39)).isEqualTo(2); // new week refills the gel
    }

    @Test
    void actifAujourdhuiRefleteLeDernierJour() {
        Serie s = serie();
        actif(s, WED_W38);
        assertThat(s.estActifAu(WED_W38)).isTrue();
        assertThat(s.estActifAu(THU_W38)).isFalse();
    }

    @Test
    void gelsRestantsAuRefleteLeRechargeHebdo() {
        Serie s = serie();
        actif(s, THU_W38);
        actif(s, SAT_W38); // gels 0 within week 38
        assertThat(s.gelsRestantsAu(SAT_W38)).isEqualTo(0);
        assertThat(s.gelsRestantsAu(MON_W39)).isEqualTo(1); // refilled in week 39
    }

    @Test
    void serieVierge() {
        Serie s = serie();
        assertThat(s.joursConsecutifsAu(MON_W38)).isEqualTo(0);
        assertThat(s.estActifAu(MON_W38)).isFalse();
        Instant now = Instant.now();
        assertThat(s.getMajAt()).isBeforeOrEqualTo(now);
    }
}
