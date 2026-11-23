package fr.brio.progression;

import fr.brio.progression.domain.Niveau;
import fr.brio.progression.domain.Serie;
import fr.brio.progression.domain.Solde;
import fr.brio.progression.infrastructure.EvenementXpRepository;
import fr.brio.progression.infrastructure.SerieRepository;
import fr.brio.progression.infrastructure.SoldeRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * The bookkeeping shared by chapter and course progression (ADR 0022, ADR 0050): streak activity,
 * the daily XP cap and the materialised balance. A plain helper, not a bean, so both services call
 * it directly. Lock order for one student is always streak → course follow-up → balance, which keeps
 * concurrent chapter and course awards from deadlocking.
 */
final class CompteurXp {

    private final EvenementXpRepository evenements;
    private final SoldeRepository soldes;
    private final SerieRepository series;

    CompteurXp(EvenementXpRepository evenements, SoldeRepository soldes, SerieRepository series) {
        this.evenements = evenements;
        this.soldes = soldes;
        this.series = series;
    }

    /** Marks the student active on the day of {@code quand} and updates the streak. */
    void enregistrerActivite(UUID eleveId, Instant quand) {
        LocalDate jour = quand.atZone(ProgressionService.ZONE).toLocalDate();
        // Create the row race-free first (#344), so the find+save below is a plain update, never a
        // second concurrent INSERT that would collide on series_pkey and roll back the whole award.
        // After creerSiAbsent the row exists, so orElseGet is only a defensive fallback.
        series.creerSiAbsent(eleveId);
        Serie serie = series.findById(eleveId).orElseGet(() -> new Serie(eleveId));
        serie.enregistrerActivite(jour, quand);
        series.save(serie);
    }

    boolean plafondAtteint(UUID eleveId, Instant quand) {
        Instant debutDuJour = quand.atZone(ProgressionService.ZONE).toLocalDate()
                .atStartOfDay(ProgressionService.ZONE).toInstant();
        return evenements.sommePointsDepuis(eleveId, debutDuJour) >= ProgressionService.PLAFOND_QUOTIDIEN;
    }

    void recalculerSolde(UUID eleveId, Instant quand) {
        // Create then lock the balance row before summing (#344): concurrent awards for the same
        // student serialize here, so each sum sees every already-committed event and the stored
        // total never drops one. The row is guaranteed to exist for the lock by creerSiAbsent.
        soldes.creerSiAbsent(eleveId);
        soldes.verrouiller(eleveId);
        int total = evenements.sommePointsPourEleve(eleveId);
        soldes.save(new Solde(eleveId, total, Niveau.pour(total), quand));
    }
}
