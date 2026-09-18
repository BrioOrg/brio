package fr.brio.progression;

import fr.brio.exercices.api.SoumissionEnregistree;
import fr.brio.progression.api.ProgressionInfo;
import fr.brio.progression.domain.EvenementXp;
import fr.brio.progression.domain.Niveau;
import fr.brio.progression.domain.Solde;
import fr.brio.progression.infrastructure.EvenementXpRepository;
import fr.brio.progression.infrastructure.SoldeRepository;
import java.time.Instant;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * XP and level engine (ADR 0022). Pure consumer of application events — it never
 * calls another module. Attribution is idempotent (once per source) and capped
 * per day; the level is derived and stored for fast reads.
 */
@Service
public class ProgressionService {

    static final String SOURCE_EXERCICE = "exercice";
    static final String MOTIF_1ER_COUP = "reussi_1er_coup";
    static final String MOTIF_APRES_ERREUR = "reussi_apres_erreur";
    static final short XP_1ER_COUP = 10;
    static final short XP_APRES_ERREUR = 6;
    static final int PLAFOND_QUOTIDIEN = 200;
    // Reference zone for the daily cap and streaks (ADR 0022 — à confirmer).
    static final ZoneId ZONE = ZoneId.of("Europe/Paris");

    private final EvenementXpRepository evenements;
    private final SoldeRepository soldes;

    ProgressionService(EvenementXpRepository evenements, SoldeRepository soldes) {
        this.evenements = evenements;
        this.soldes = soldes;
    }

    /** Award XP for a graded submission. No-op unless it was solved. */
    @Transactional
    public void attribuerPourSoumission(SoumissionEnregistree e) {
        if (!e.correct()) {
            return; // an error costs nothing (ADR 0022 barème)
        }

        String sourceRef = e.exerciceId().toString();
        // Once per exercise: any prior XP for this source (either motif) closes it.
        if (evenements.existsByEleveIdAndSourceTypeAndSourceRef(e.eleveId(), SOURCE_EXERCICE, sourceRef)) {
            return;
        }

        Instant quand = e.submittedAt() != null ? e.submittedAt() : Instant.now();
        if (plafondAtteint(e.eleveId(), quand)) {
            return; // daily cap reached — surplus not inserted
        }

        String motif = e.premiereTentative() ? MOTIF_1ER_COUP : MOTIF_APRES_ERREUR;
        short points = e.premiereTentative() ? XP_1ER_COUP : XP_APRES_ERREUR;

        try {
            evenements.save(new EvenementXp(e.eleveId(), SOURCE_EXERCICE, sourceRef, motif, points, quand));
        } catch (DataIntegrityViolationException raceOnUniqueConstraint) {
            return; // another delivery won; idempotent by construction
        }

        recalculerSolde(e.eleveId(), quand);
    }

    /** Current XP and level for a student (0/0 if none yet). */
    @Transactional(readOnly = true)
    public ProgressionInfo pour(UUID eleveId) {
        return soldes.findById(eleveId)
                .map(s -> new ProgressionInfo(s.getXpTotal(), s.getNiveau()))
                .orElse(new ProgressionInfo(0, 0));
    }

    private boolean plafondAtteint(UUID eleveId, Instant quand) {
        Instant debutDuJour = quand.atZone(ZONE).toLocalDate().atStartOfDay(ZONE).toInstant();
        return evenements.sommePointsDepuis(eleveId, debutDuJour) >= PLAFOND_QUOTIDIEN;
    }

    private void recalculerSolde(UUID eleveId, Instant quand) {
        int total = evenements.sommePointsPourEleve(eleveId);
        soldes.save(new Solde(eleveId, total, Niveau.pour(total), quand));
    }
}
