package fr.brio.progression.infrastructure;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Repository;

/**
 * Course progression tables (V45, ADR 0050). Native SQL on purpose: every write is an
 * {@code INSERT … ON CONFLICT} whose row count tells the caller whether it created the fact, and
 * the follow-up row is locked with {@code FOR UPDATE}. An exists-then-save pair would surface a
 * duplicate key at commit, outside any catch, and lose the whole event.
 */
@Repository
public class CoursProgressionRepository {

    public static final String SECTION = "section";
    public static final String EXERCICE = "exercice";

    @PersistenceContext
    private EntityManager em;

    // ── projection (structural) ──────────────────────────────────────────────

    /**
     * Inserts the course or moves it to a newer version; a same or older version touches nothing
     * (re-announced at startup, or delivered out of order). Returns whether the row changed.
     */
    public boolean projeterVersion(UUID coursId, int version) {
        return em.createNativeQuery("""
                INSERT INTO progression.cours (cours_id, version, maj_at) VALUES (:cours, :version, now())
                ON CONFLICT (cours_id) DO UPDATE SET version = EXCLUDED.version, maj_at = now()
                WHERE progression.cours.version < EXCLUDED.version""")
                .setParameter("cours", coursId)
                .setParameter("version", version)
                .executeUpdate() > 0;
    }

    /** Replaces the counted elements of a course (call only after {@link #projeterVersion} changed it). */
    public void remplacerElements(UUID coursId, List<String> sections, List<String> exercices) {
        em.createNativeQuery("DELETE FROM progression.cours_elements WHERE cours_id = :cours")
                .setParameter("cours", coursId)
                .executeUpdate();
        insererElements(coursId, SECTION, sections);
        insererElements(coursId, EXERCICE, exercices);
    }

    private void insererElements(UUID coursId, String nature, Collection<String> cles) {
        for (String cle : cles) {
            em.createNativeQuery("""
                    INSERT INTO progression.cours_elements (cours_id, nature, cle) VALUES (:cours, :nature, :cle)
                    ON CONFLICT DO NOTHING""")
                    .setParameter("cours", coursId)
                    .setParameter("nature", nature)
                    .setParameter("cle", cle)
                    .executeUpdate();
        }
    }

    /** Section and exercise totals of the projected version, empty if the course is not projected. */
    public Optional<Structure> structure(UUID coursId) {
        List<?> lignes = em.createNativeQuery("""
                SELECT (SELECT count(*) FROM progression.cours_elements e
                         WHERE e.cours_id = c.cours_id AND e.nature = 'section'),
                       (SELECT count(*) FROM progression.cours_elements e
                         WHERE e.cours_id = c.cours_id AND e.nature = 'exercice')
                FROM progression.cours c WHERE c.cours_id = :cours""")
                .setParameter("cours", coursId)
                .getResultList();
        if (lignes.isEmpty()) {
            return Optional.empty();
        }
        Object[] l = (Object[]) lignes.get(0);
        return Optional.of(new Structure(((Number) l[0]).intValue(), ((Number) l[1]).intValue()));
    }

    // ── facts of one student ─────────────────────────────────────────────────

    /** Creates the student's follow-up row for the course if missing (race-free). */
    public void creerSuivi(UUID eleveId, UUID coursId) {
        em.createNativeQuery("""
                INSERT INTO progression.cours_suivis (eleve_id, cours_id) VALUES (:eleve, :cours)
                ON CONFLICT DO NOTHING""")
                .setParameter("eleve", eleveId)
                .setParameter("cours", coursId)
                .executeUpdate();
    }

    /**
     * Locks the follow-up row (it must exist — {@link #creerSuivi} first) and tells whether the
     * course is already done. Two facts of one (student, course) are then evaluated one after the
     * other, the second seeing the first's committed row (ADR 0050 §4).
     */
    public boolean verrouillerSuivi(UUID eleveId, UUID coursId) {
        Object termineAt = em.createNativeQuery("""
                SELECT termine_at FROM progression.cours_suivis
                WHERE eleve_id = :eleve AND cours_id = :cours FOR UPDATE""")
                .setParameter("eleve", eleveId)
                .setParameter("cours", coursId)
                .getSingleResult();
        return termineAt != null;
    }

    /** Sticky completion: sets {@code termine_at} once, never back to NULL. */
    public void marquerTermine(UUID eleveId, UUID coursId, Instant quand) {
        em.createNativeQuery("""
                UPDATE progression.cours_suivis SET termine_at = :quand
                WHERE eleve_id = :eleve AND cours_id = :cours AND termine_at IS NULL""")
                .setParameter("quand", Timestamp.from(quand))
                .setParameter("eleve", eleveId)
                .setParameter("cours", coursId)
                .executeUpdate();
    }

    /** Records a section read; returns whether this call created it (only then is XP awarded). */
    public boolean enregistrerSectionLue(UUID eleveId, UUID coursId, String sectionId, Instant quand) {
        return em.createNativeQuery("""
                INSERT INTO progression.cours_sections_lues (eleve_id, cours_id, section_id, lu_at)
                VALUES (:eleve, :cours, :cle, :quand)
                ON CONFLICT (eleve_id, cours_id, section_id) DO NOTHING""")
                .setParameter("eleve", eleveId)
                .setParameter("cours", coursId)
                .setParameter("cle", sectionId)
                .setParameter("quand", Timestamp.from(quand))
                .executeUpdate() > 0;
    }

    /** Records a solved exercise by stable key; returns whether this call created it. */
    public boolean enregistrerExerciceReussi(UUID eleveId, UUID coursId, String cle, Instant quand) {
        return em.createNativeQuery("""
                INSERT INTO progression.cours_exercices_reussis (eleve_id, cours_id, exercice_cle, reussi_at)
                VALUES (:eleve, :cours, :cle, :quand)
                ON CONFLICT (eleve_id, cours_id, exercice_cle) DO NOTHING""")
                .setParameter("eleve", eleveId)
                .setParameter("cours", coursId)
                .setParameter("cle", cle)
                .setParameter("quand", Timestamp.from(quand))
                .executeUpdate() > 0;
    }

    /**
     * The student's facts counted against the <b>current</b> elements only (intersection): a
     * section dropped from the published version no longer counts (ADR 0050 §5).
     */
    public Faits faits(UUID eleveId, UUID coursId) {
        Object[] l = (Object[]) em.createNativeQuery("""
                SELECT (SELECT count(*) FROM progression.cours_sections_lues s
                          JOIN progression.cours_elements e
                            ON e.cours_id = s.cours_id AND e.nature = 'section' AND e.cle = s.section_id
                         WHERE s.eleve_id = :eleve AND s.cours_id = :cours),
                       (SELECT count(*) FROM progression.cours_exercices_reussis r
                          JOIN progression.cours_elements e
                            ON e.cours_id = r.cours_id AND e.nature = 'exercice' AND e.cle = r.exercice_cle
                         WHERE r.eleve_id = :eleve AND r.cours_id = :cours),
                       (SELECT termine_at IS NOT NULL FROM progression.cours_suivis
                         WHERE eleve_id = :eleve AND cours_id = :cours)""")
                .setParameter("eleve", eleveId)
                .setParameter("cours", coursId)
                .getSingleResult();
        return new Faits(((Number) l[0]).intValue(), ((Number) l[1]).intValue(), Boolean.TRUE.equals(l[2]));
    }

    /** Whether the student has any row for this course (a follow-up or a read). */
    public boolean aDesLignes(UUID eleveId, UUID coursId) {
        Object r = em.createNativeQuery("""
                SELECT EXISTS (SELECT 1 FROM progression.cours_suivis WHERE eleve_id = :eleve AND cours_id = :cours)
                    OR EXISTS (SELECT 1 FROM progression.cours_sections_lues WHERE eleve_id = :eleve AND cours_id = :cours)""")
                .setParameter("eleve", eleveId)
                .setParameter("cours", coursId)
                .getSingleResult();
        return Boolean.TRUE.equals(r);
    }

    /** The courses the student read a section of, latest read first. */
    public List<LectureCours> lecturesParCours(UUID eleveId) {
        List<?> lignes = em.createNativeQuery("""
                SELECT cours_id, max(lu_at) FROM progression.cours_sections_lues
                WHERE eleve_id = :eleve GROUP BY cours_id ORDER BY max(lu_at) DESC""")
                .setParameter("eleve", eleveId)
                .getResultList();
        return lignes.stream().map(o -> {
            Object[] l = (Object[]) o;
            return new LectureCours((UUID) l[0], instant(l[1]));
        }).toList();
    }

    // ── XP ───────────────────────────────────────────────────────────────────

    /** Inserts an XP event unless the same (student, source, motif) exists; returns whether it did. */
    public boolean insererXp(UUID eleveId, String sourceType, String sourceRef, String motif,
                             short points, Instant quand) {
        return em.createNativeQuery("""
                INSERT INTO progression.evenements_xp (id, eleve_id, source_type, source_ref, motif, points, created_at)
                VALUES (gen_random_uuid(), :eleve, :type, :ref, :motif, :points, :quand)
                ON CONFLICT ON CONSTRAINT uq_evenements_xp_source DO NOTHING""")
                .setParameter("eleve", eleveId)
                .setParameter("type", sourceType)
                .setParameter("ref", sourceRef)
                .setParameter("motif", motif)
                .setParameter("points", points)
                .setParameter("quand", Timestamp.from(quand))
                .executeUpdate() > 0;
    }

    private static Instant instant(Object valeur) {
        if (valeur instanceof Instant i) {
            return i;
        }
        if (valeur instanceof Timestamp t) {
            return t.toInstant();
        }
        if (valeur instanceof java.time.OffsetDateTime o) {
            return o.toInstant();
        }
        throw new IllegalStateException("Unexpected timestamp type: " + valeur);
    }

    public record Structure(int sections, int exercices) {}

    public record Faits(int sectionsLues, int exercicesReussis, boolean termine) {}

    public record LectureCours(UUID coursId, Instant derniereLecture) {}
}
