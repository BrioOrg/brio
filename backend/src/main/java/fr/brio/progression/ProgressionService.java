package fr.brio.progression;

import fr.brio.contenu.api.ChapitrePublie;
import fr.brio.contenu.api.SectionTerminee;
import fr.brio.exercices.api.SoumissionEnregistree;
import fr.brio.progression.api.ChapitreTermine;
import fr.brio.progression.api.EtatParcours;
import fr.brio.progression.api.MaitriseInfo;
import fr.brio.progression.api.ParcoursChapitre;
import fr.brio.progression.api.ProgressionInfo;
import fr.brio.progression.api.SerieInfo;
import fr.brio.progression.domain.Chapitre;
import fr.brio.progression.domain.EvenementXp;
import fr.brio.progression.domain.ExerciceReussi;
import fr.brio.progression.domain.Maitrise;
import fr.brio.progression.domain.Niveau;
import fr.brio.progression.domain.NiveauMaitrise;
import fr.brio.progression.domain.SectionLue;
import fr.brio.progression.domain.Serie;
import fr.brio.progression.domain.Solde;
import fr.brio.progression.domain.SoumissionCompetence;
import fr.brio.progression.infrastructure.ChapitreProjectionRepository;
import fr.brio.progression.infrastructure.EvenementXpRepository;
import fr.brio.progression.infrastructure.ExerciceReussiRepository;
import fr.brio.progression.infrastructure.MaitriseRepository;
import fr.brio.progression.infrastructure.SectionLueRepository;
import fr.brio.progression.infrastructure.SerieRepository;
import fr.brio.progression.infrastructure.SoldeRepository;
import fr.brio.progression.infrastructure.SoumissionCompetenceRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * XP, completion and path-state engine (ADR 0022). Pure consumer of application
 * events — it never calls another module; chapter structure arrives via
 * {@link ChapitrePublie} and is projected locally. Attribution is idempotent and
 * (for exercises) capped per day; completion is tracked in its own tables so it
 * survives the XP cap, and level/percentage are derived for fast reads.
 */
@Service
public class ProgressionService {

    static final String SOURCE_EXERCICE = "exercice";
    static final String SOURCE_SECTION = "section";
    static final String SOURCE_CHAPITRE = "chapitre";
    static final String MOTIF_1ER_COUP = "reussi_1er_coup";
    static final String MOTIF_APRES_ERREUR = "reussi_apres_erreur";
    static final String MOTIF_SECTION = "section_terminee";
    static final String MOTIF_CHAPITRE = "chapitre_termine";
    static final short XP_1ER_COUP = 10;
    static final short XP_APRES_ERREUR = 6;
    static final short XP_SECTION = 2;
    static final short XP_CHAPITRE = 50;
    static final int PLAFOND_QUOTIDIEN = 200;
    // A chapter is complete when this fraction of its exercises is solved (ADR 0022).
    static final int SEUIL_EXERCICES_PCT = 80;
    // Reference zone for the daily cap and streaks (ADR 0022 — à confirmer).
    static final ZoneId ZONE = ZoneId.of("Europe/Paris");

    private final EvenementXpRepository evenements;
    private final SoldeRepository soldes;
    private final ChapitreProjectionRepository chapitres;
    private final SectionLueRepository sectionsLues;
    private final ExerciceReussiRepository exercicesReussis;
    private final SerieRepository series;
    private final SoumissionCompetenceRepository soumissionsCompetences;
    private final MaitriseRepository maitrises;
    private final ApplicationEventPublisher events;

    ProgressionService(
            EvenementXpRepository evenements,
            SoldeRepository soldes,
            ChapitreProjectionRepository chapitres,
            SectionLueRepository sectionsLues,
            ExerciceReussiRepository exercicesReussis,
            SerieRepository series,
            SoumissionCompetenceRepository soumissionsCompetences,
            MaitriseRepository maitrises,
            ApplicationEventPublisher events) {
        this.evenements = evenements;
        this.soldes = soldes;
        this.chapitres = chapitres;
        this.sectionsLues = sectionsLues;
        this.exercicesReussis = exercicesReussis;
        this.series = series;
        this.soumissionsCompetences = soumissionsCompetences;
        this.maitrises = maitrises;
        this.events = events;
    }

    /** Upserts the local projection of a published chapter's structure. */
    @Transactional
    public void enregistrerChapitre(ChapitrePublie e) {
        Chapitre chapitre = chapitres.findById(e.chapitreId()).orElseGet(() -> new Chapitre(e.chapitreId()));
        chapitre.maj(e.niveauCode(), e.matiereCode(), e.ordre(), e.statut(),
                e.totalSections(), e.totalExercices());
        chapitres.save(chapitre);
    }

    /** Award XP for a graded submission and track it toward chapter completion. */
    @Transactional
    public void attribuerPourSoumission(SoumissionEnregistree e) {
        Instant quand = e.submittedAt() != null ? e.submittedAt() : Instant.now();

        // Any submission — right or wrong — is activity for the streak (decision #95).
        enregistrerActivite(e.eleveId(), quand);

        // Mastery counts both hits and misses toward the sample, so record it before the
        // early return below — an error still tells us something about the competence (#96).
        enregistrerMaitrise(e, quand);

        if (!e.correct()) {
            return; // an error costs nothing (ADR 0022 barème)
        }

        String motif = e.premiereTentative() ? MOTIF_1ER_COUP : MOTIF_APRES_ERREUR;
        short points = e.premiereTentative() ? XP_1ER_COUP : XP_APRES_ERREUR;
        attribuer(e.eleveId(), SOURCE_EXERCICE, e.exerciceId().toString(), motif, points, quand, true);

        // Completion tracking is independent of the XP award above: a solve past the
        // daily cap earns no XP but must still count toward the 80 % gate.
        if (e.chapitreId() != null) {
            enregistrerExerciceReussi(e.eleveId(), e.chapitreId(), e.exerciceId(), quand);
            evaluerCompletion(e.eleveId(), e.chapitreId(), quand);
        }
    }

    /** Record a section read, award its XP (cap-exempt), and re-check completion. */
    @Transactional
    public void onSectionTerminee(SectionTerminee e) {
        Instant quand = e.survenuLe() != null ? e.survenuLe() : Instant.now();

        enregistrerActivite(e.eleveId(), quand); // a section read is activity too (#95)
        enregistrerSectionLue(e.eleveId(), e.chapitreId(), e.sectionId(), quand);
        attribuer(e.eleveId(), SOURCE_SECTION, e.chapitreId() + "/" + e.sectionId(),
                MOTIF_SECTION, XP_SECTION, quand, false);
        evaluerCompletion(e.eleveId(), e.chapitreId(), quand);
    }

    /** Current XP and level for a student (0/0 if none yet). */
    @Transactional(readOnly = true)
    public ProgressionInfo pour(UUID eleveId) {
        return soldes.findById(eleveId)
                .map(s -> new ProgressionInfo(s.getXpTotal(), s.getNiveau()))
                .orElse(new ProgressionInfo(0, 0));
    }

    /**
     * Current day streak for a student, decayed to today: a streak past the freeze
     * tolerance reads 0 without needing a write. Empty (0 / null) if none yet.
     */
    @Transactional(readOnly = true)
    public SerieInfo serie(UUID eleveId) {
        LocalDate aujourdhui = LocalDate.now(ZONE);
        return series.findById(eleveId)
                .map(s -> new SerieInfo(
                        s.joursConsecutifsAu(aujourdhui),
                        s.getDernierJourActif(),
                        s.gelsRestantsAu(aujourdhui),
                        s.estActifAu(aujourdhui)))
                .orElse(new SerieInfo(0, null, Serie.GELS_PAR_SEMAINE, false));
    }

    /**
     * Mastery per competence for a student: only competences the student has actually
     * submitted to appear (never the whole referential). {@code niveau} is null while the
     * sample is below the honesty threshold (ADR 0022 §6).
     */
    @Transactional(readOnly = true)
    public List<MaitriseInfo> maitrise(UUID eleveId) {
        return maitrises.findByIdEleveId(eleveId).stream()
                .map(m -> new MaitriseInfo(
                        m.getCompetenceCode(),
                        m.getNiveau() == null ? null : (int) (short) m.getNiveau(),
                        m.getEchantillon()))
                .toList();
    }

    /**
     * Rebuilds every mastery row for a student from the stored submission projection —
     * the "recalculable intégralement depuis les soumissions" guarantee (ADR 0022 §6).
     * The projection is progression's own copy, fed by {@code SoumissionEnregistree};
     * it is never read back from exercices (§3 forbids the outbound call).
     */
    @Transactional
    public void recalculer(UUID eleveId) {
        Instant maintenant = Instant.now();
        for (String code : soumissionsCompetences.competencesDeLEleve(eleveId)) {
            recalculerMaitrise(eleveId, code, maintenant);
        }
    }

    /**
     * Path state of every published chapter in a track, in order. Locks are
     * sequential (a chapter unlocks when the previous one is done) and monotonic:
     * a chapter the student has touched stays unlocked even if the track is later
     * reordered. Under normal play exactly one chapter is {@code EN_COURS}.
     */
    @Transactional(readOnly = true)
    public List<ParcoursChapitre> parcours(String niveauCode, String matiereCode, UUID eleveId) {
        List<Chapitre> track = chapitres
                .findByNiveauCodeAndMatiereCodeAndStatutOrderByOrdreAsc(niveauCode, matiereCode, "published");

        List<ParcoursChapitre> resultat = new ArrayList<>(track.size());
        boolean predecesseurTermine = true; // the first chapter's "predecessor" counts as done
        for (Chapitre c : track) {
            long sl = sectionsLues.countByEleveIdAndChapitreId(eleveId, c.getChapitreId());
            long er = exercicesReussis.countByEleveIdAndChapitreId(eleveId, c.getChapitreId());
            boolean touche = sl > 0 || er > 0;
            boolean termine = estTermine(eleveId, c, sl, er);

            EtatParcours etat;
            if (termine) {
                etat = EtatParcours.FAIT;
            } else if (predecesseurTermine || touche) {
                etat = EtatParcours.EN_COURS;
            } else {
                etat = EtatParcours.VERROUILLE;
            }

            resultat.add(new ParcoursChapitre(c.getChapitreId(), c.getOrdre(), etat,
                    pourcentage(c, sl, er, termine)));
            predecesseurTermine = termine;
        }
        return resultat;
    }

    // ── internals ─────────────────────────────────────────────────────────────

    /** Marks the student active on the day of {@code quand} and updates the streak. */
    private void enregistrerActivite(UUID eleveId, Instant quand) {
        LocalDate jour = quand.atZone(ZONE).toLocalDate();
        Serie serie = series.findById(eleveId).orElseGet(() -> new Serie(eleveId));
        serie.enregistrerActivite(jour, quand);
        series.save(serie);
    }

    /** Records the submission for each of its competences, then refreshes their mastery. */
    private void enregistrerMaitrise(SoumissionEnregistree e, Instant quand) {
        if (e.soumissionId() == null) {
            return; // legacy event without a submission id — cannot dedupe, so skip mastery
        }
        for (String code : e.competencies()) {
            enregistrerSoumissionCompetence(e, code, quand);
            recalculerMaitrise(e.eleveId(), code, quand);
        }
    }

    private void enregistrerSoumissionCompetence(SoumissionEnregistree e, String code, Instant quand) {
        if (soumissionsCompetences.existsBySoumissionIdAndCompetenceCode(e.soumissionId(), code)) {
            return;
        }
        try {
            soumissionsCompetences.save(new SoumissionCompetence(
                    e.eleveId(), e.soumissionId(), code, e.correct(), e.score(),
                    e.premiereTentative(), quand));
        } catch (DataIntegrityViolationException raceOnUniqueConstraint) {
            // another delivery won; idempotent by construction (redelivery-safe)
        }
    }

    /** Derives the mastery of one competence from its last N first attempts and upserts it. */
    private void recalculerMaitrise(UUID eleveId, String code, Instant quand) {
        List<SoumissionCompetence> fenetre = soumissionsCompetences.fenetre(
                eleveId, code, PageRequest.of(0, NiveauMaitrise.FENETRE));
        int echantillon = fenetre.size();
        int reussites = (int) fenetre.stream().filter(SoumissionCompetence::isCorrect).count();
        OptionalInt niveau = NiveauMaitrise.pour(reussites, echantillon);
        maitrises.save(new Maitrise(eleveId, code,
                niveau.isPresent() ? (short) niveau.getAsInt() : null, echantillon, quand));
    }

    private void enregistrerSectionLue(UUID eleveId, String chapitreId, String sectionId, Instant quand) {
        if (sectionsLues.existsByEleveIdAndChapitreIdAndSectionId(eleveId, chapitreId, sectionId)) {
            return;
        }
        try {
            sectionsLues.save(new SectionLue(eleveId, chapitreId, sectionId, quand));
        } catch (DataIntegrityViolationException raceOnUniqueConstraint) {
            // another delivery won; idempotent by construction
        }
    }

    private void enregistrerExerciceReussi(UUID eleveId, String chapitreId, UUID exerciceId, Instant quand) {
        if (exercicesReussis.existsByEleveIdAndChapitreIdAndExerciceId(eleveId, chapitreId, exerciceId)) {
            return;
        }
        try {
            exercicesReussis.save(new ExerciceReussi(eleveId, chapitreId, exerciceId, quand));
        } catch (DataIntegrityViolationException raceOnUniqueConstraint) {
            // idempotent by construction
        }
    }

    /**
     * Awards the chapter-completion XP (cap-exempt) and emits {@link ChapitreTermine}
     * the first time a chapter's completion condition holds. No-op afterwards.
     */
    private void evaluerCompletion(UUID eleveId, String chapitreId, Instant quand) {
        Optional<Chapitre> projete = chapitres.findById(chapitreId);
        if (projete.isEmpty()) {
            return; // structure not projected yet — cannot evaluate; a later event will retry
        }
        if (chapitreDejaTermine(eleveId, chapitreId)) {
            return; // already awarded — completion is sticky (idempotent)
        }
        long sl = sectionsLues.countByEleveIdAndChapitreId(eleveId, chapitreId);
        long er = exercicesReussis.countByEleveIdAndChapitreId(eleveId, chapitreId);
        if (!conditionTerminee(projete.get(), sl, er)) {
            return;
        }
        attribuer(eleveId, SOURCE_CHAPITRE, chapitreId, MOTIF_CHAPITRE, XP_CHAPITRE, quand, false);
        events.publishEvent(new ChapitreTermine(eleveId, chapitreId, quand));
    }

    /** Sticky completion: once the chapter award exists, it stays done. */
    private boolean estTermine(UUID eleveId, Chapitre c, long sectionsLuesCount, long exercicesReussisCount) {
        return chapitreDejaTermine(eleveId, c.getChapitreId())
                || conditionTerminee(c, sectionsLuesCount, exercicesReussisCount);
    }

    private boolean chapitreDejaTermine(UUID eleveId, String chapitreId) {
        return evenements.existsByEleveIdAndSourceTypeAndSourceRef(eleveId, SOURCE_CHAPITRE, chapitreId);
    }

    /** All sections read and ≥ 80 % of exercises solved (ADR 0022). */
    private boolean conditionTerminee(Chapitre c, long sectionsLuesCount, long exercicesReussisCount) {
        if (c.getTotalSections() <= 0) {
            return false; // not a real, readable chapter
        }
        boolean toutesSections = sectionsLuesCount >= c.getTotalSections();
        boolean assezExercices = c.getTotalExercices() == 0
                || exercicesReussisCount * 100 >= (long) SEUIL_EXERCICES_PCT * c.getTotalExercices();
        return toutesSections && assezExercices;
    }

    private int pourcentage(Chapitre c, long sectionsLuesCount, long exercicesReussisCount, boolean termine) {
        if (termine) {
            return 100; // clamp: a done chapter always reads 100 % (ADR 0022 #94)
        }
        int total = c.getTotalSections() + c.getTotalExercices();
        if (total <= 0) {
            return 0;
        }
        long fait = Math.min(sectionsLuesCount, c.getTotalSections())
                + Math.min(exercicesReussisCount, c.getTotalExercices());
        int pct = (int) Math.round(100.0 * fait / total);
        return Math.max(0, Math.min(100, pct));
    }

    /**
     * Idempotent (once per source) XP award. Exercise awards are capped per day;
     * completion awards (section/chapter) pass {@code plafonne = false} because they
     * are bounded by construction and must not be lost to a heavy day (ADR 0022).
     */
    private void attribuer(UUID eleveId, String sourceType, String sourceRef,
                           String motif, short points, Instant quand, boolean plafonne) {
        if (evenements.existsByEleveIdAndSourceTypeAndSourceRef(eleveId, sourceType, sourceRef)) {
            return;
        }
        if (plafonne && plafondAtteint(eleveId, quand)) {
            return; // daily cap reached — surplus not inserted
        }
        try {
            evenements.save(new EvenementXp(eleveId, sourceType, sourceRef, motif, points, quand));
        } catch (DataIntegrityViolationException raceOnUniqueConstraint) {
            return; // another delivery won; idempotent by construction
        }
        recalculerSolde(eleveId, quand);
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
