package fr.brio.progression;

import fr.brio.contenu.api.CoursPublie;
import fr.brio.contenu.api.SectionCoursLue;
import fr.brio.exercices.api.SoumissionEnregistree;
import fr.brio.progression.api.ProgressionCoursInfo;
import fr.brio.progression.infrastructure.CoursProgressionRepository;
import fr.brio.progression.infrastructure.CoursProgressionRepository.Faits;
import fr.brio.progression.infrastructure.CoursProgressionRepository.LectureCours;
import fr.brio.progression.infrastructure.CoursProgressionRepository.Structure;
import fr.brio.progression.infrastructure.EvenementXpRepository;
import fr.brio.progression.infrastructure.SerieRepository;
import fr.brio.progression.infrastructure.SoldeRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Progression of teacher courses (ADR 0050). Fed by events only — {@link CoursPublie} for the
 * structure, {@link SectionCoursLue} and {@link SoumissionEnregistree} for a student's facts — and
 * never calls another module (ADR 0022 §3 holds here; the one read exception lives in
 * {@code progression.web}).
 *
 * <p>Facts are keyed by the editor's stable ids, so a republication that keeps its sections and
 * exercises keeps the gauge. Every fact is an {@code INSERT … ON CONFLICT DO NOTHING}, and XP is
 * awarded only when that insert created the row: a replayed or doubled event earns nothing twice.
 * The student's follow-up row is locked first and completion is evaluated under that lock, before
 * any other per-student lock, so the last section and the last exercise landing together still see
 * each other and mark the course done. Lock order: course follow-up → streak → balance; chapter
 * flows take streak → balance only, so the two never deadlock.
 */
@Service
public class ProgressionCoursService {

    static final String SOURCE_COURS_SECTION = "cours_section";
    static final String SOURCE_COURS_EXERCICE = "cours_exercice";

    private final CoursProgressionRepository cours;
    private final EvenementXpRepository evenements;
    private final CompteurXp compteur;

    ProgressionCoursService(
            CoursProgressionRepository cours,
            EvenementXpRepository evenements,
            SoldeRepository soldes,
            SerieRepository series) {
        this.cours = cours;
        this.evenements = evenements;
        this.compteur = new CompteurXp(evenements, soldes, series);
    }

    /**
     * Projects a published version's structure. A same or older version is ignored (startup
     * re-announcement, out-of-order delivery). Never touches a student's facts, XP or completion.
     */
    @Transactional
    public void enregistrerCours(CoursPublie e) {
        if (cours.projeterVersion(e.coursId(), e.version())) {
            cours.remplacerElements(e.coursId(), e.sectionIds(), e.exerciceCles());
        }
    }

    /** Records a section read, awards its XP (+2, within the daily cap) and re-checks completion. */
    @Transactional
    public void onSectionCoursLue(SectionCoursLue e) {
        Instant quand = e.survenuLe() != null ? e.survenuLe() : Instant.now();
        boolean dejaTermine = suivre(e.eleveId(), e.coursId());
        boolean nouvelle = cours.enregistrerSectionLue(e.eleveId(), e.coursId(), e.sectionId(), quand);
        evaluerCompletion(e.eleveId(), e.coursId(), dejaTermine, quand);
        compteur.enregistrerActivite(e.eleveId(), quand); // a section read is activity too (#95)
        if (nouvelle) {
            attribuer(e.eleveId(), SOURCE_COURS_SECTION, e.coursId() + "/" + e.sectionId(),
                    ProgressionService.MOTIF_SECTION, ProgressionService.XP_SECTION, quand);
        }
    }

    /**
     * Records a solved course exercise by its stable key, re-checks completion and awards its XP
     * once. Runs <b>before</b> {@link ProgressionService#attribuerPourSoumission} in the listener, so
     * the follow-up lock is taken first (lock order: course follow-up → streak → balance).
     */
    @Transactional
    public void onSoumission(SoumissionEnregistree e) {
        if (e.coursId() == null || e.exerciceCle() == null || !e.correct()) {
            return;
        }
        Instant quand = e.submittedAt() != null ? e.submittedAt() : Instant.now();
        boolean dejaTermine = suivre(e.eleveId(), e.coursId());
        boolean nouveau = cours.enregistrerExerciceReussi(e.eleveId(), e.coursId(), e.exerciceCle(), quand);
        evaluerCompletion(e.eleveId(), e.coursId(), dejaTermine, quand);
        compteur.enregistrerActivite(e.eleveId(), quand);
        // Transition: a solve already rewarded under the per-version UUID key earns nothing more.
        if (nouveau && !evenements.existsByEleveIdAndSourceTypeAndSourceRef(
                e.eleveId(), ProgressionService.SOURCE_EXERCICE, e.exerciceId().toString())) {
            boolean premier = e.premiereTentative();
            attribuer(e.eleveId(), SOURCE_COURS_EXERCICE, e.coursId() + "/" + e.exerciceCle(),
                    premier ? ProgressionService.MOTIF_1ER_COUP : ProgressionService.MOTIF_APRES_ERREUR,
                    premier ? ProgressionService.XP_1ER_COUP : ProgressionService.XP_APRES_ERREUR, quand);
        }
    }

    /**
     * The student's gauge for a course. Empty when the course is not projected, or when the student
     * has no row for it: the route then says nothing about a course they never opened (ADR 0050 §5).
     */
    @Transactional(readOnly = true)
    public Optional<ProgressionCoursInfo> jauge(UUID eleveId, UUID coursId) {
        Optional<Structure> structure = cours.structure(coursId);
        if (structure.isEmpty() || !cours.aDesLignes(eleveId, coursId)) {
            return Optional.empty();
        }
        Faits faits = cours.faits(eleveId, coursId);
        boolean termine = faits.termine() || conditionTerminee(structure.get(), faits);
        return Optional.of(new ProgressionCoursInfo(coursId, pourcentage(structure.get(), faits, termine),
                termine, faits.sectionsLues(), structure.get().sections()));
    }

    /**
     * Courses the student read without finishing, latest read first, projected only. Whether the
     * student may still open one is not known here: {@code progression.web} filters (ADR 0050 §2).
     */
    @Transactional(readOnly = true)
    public List<CoursEnCours> coursEnCours(UUID eleveId) {
        List<CoursEnCours> resultat = new ArrayList<>();
        for (LectureCours lecture : cours.lecturesParCours(eleveId)) {
            Optional<Structure> structure = cours.structure(lecture.coursId());
            if (structure.isEmpty()) {
                continue;
            }
            Faits faits = cours.faits(eleveId, lecture.coursId());
            if (faits.termine() || conditionTerminee(structure.get(), faits)) {
                continue;
            }
            resultat.add(new CoursEnCours(lecture.coursId(), faits.sectionsLues(), structure.get().sections(),
                    lecture.derniereLecture()));
        }
        return resultat;
    }

    /** A course in progress for a student: counts against the current version, latest read. */
    public record CoursEnCours(UUID coursId, int sectionsLues, int sectionsTotal, Instant derniereLecture) {}

    // ── internals ─────────────────────────────────────────────────────────────

    /** Creates then locks the student's follow-up row; returns whether the course is already done. */
    private boolean suivre(UUID eleveId, UUID coursId) {
        cours.creerSuivi(eleveId, coursId);
        return cours.verrouillerSuivi(eleveId, coursId);
    }

    /** Sets the sticky completion the first time the condition holds. No XP (ADR 0050 §5, Q2 → B). */
    private void evaluerCompletion(UUID eleveId, UUID coursId, boolean dejaTermine, Instant quand) {
        if (dejaTermine) {
            return;
        }
        Optional<Structure> structure = cours.structure(coursId);
        if (structure.isEmpty()) {
            return; // not projected yet — a later fact will retry
        }
        if (conditionTerminee(structure.get(), cours.faits(eleveId, coursId))) {
            cours.marquerTermine(eleveId, coursId, quand);
        }
    }

    /** XP within the daily cap; course sections count toward it, unlike chapter sections (ADR 0050 §5). */
    private void attribuer(UUID eleveId, String sourceType, String sourceRef, String motif, short points,
                           Instant quand) {
        if (compteur.plafondAtteint(eleveId, quand)) {
            return;
        }
        if (cours.insererXp(eleveId, sourceType, sourceRef, motif, points, quand)) {
            compteur.recalculerSolde(eleveId, quand);
        }
    }

    /** All current sections read and ≥ 80 % of current gradable exercises solved (ADR 0022). */
    static boolean conditionTerminee(Structure s, Faits f) {
        if (s.sections() <= 0) {
            return false;
        }
        boolean toutesSections = f.sectionsLues() >= s.sections();
        boolean assezExercices = s.exercices() == 0
                || (long) f.exercicesReussis() * 100 >= (long) ProgressionService.SEUIL_EXERCICES_PCT * s.exercices();
        return toutesSections && assezExercices;
    }

    static int pourcentage(Structure s, Faits f, boolean termine) {
        if (termine) {
            return 100;
        }
        int total = s.sections() + s.exercices();
        if (total <= 0) {
            return 0;
        }
        long fait = Math.min(f.sectionsLues(), s.sections()) + Math.min(f.exercicesReussis(), s.exercices());
        return Math.max(0, Math.min(100, (int) Math.round(100.0 * fait / total)));
    }
}
