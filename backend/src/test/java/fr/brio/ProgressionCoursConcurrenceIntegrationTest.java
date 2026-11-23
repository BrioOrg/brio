package fr.brio;

import static org.assertj.core.api.Assertions.assertThat;

import fr.brio.contenu.api.CoursPublie;
import fr.brio.contenu.api.SectionCoursLue;
import fr.brio.exercices.api.SoumissionEnregistree;
import fr.brio.progression.ProgressionCoursService;
import fr.brio.progression.ProgressionService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Concurrent writes on one (student, course) (ADR 0050 §4, plan technique #400 §7). Not
 * {@code @Transactional}: each thread commits, so the races are real. Counter-proofs, played once
 * locally and recorded in the PR (not committed):
 * <ul>
 *   <li>P1 — drop {@code ON CONFLICT … DO NOTHING} from {@code enregistrerSectionLue}: the second
 *       thread fails on {@code uq_cours_sections_lues} → red.</li>
 *   <li>P2 — drop {@code FOR UPDATE} from {@code verrouillerSuivi}: an iteration leaves
 *       {@code termine_at} NULL (write skew) → red.</li>
 *   <li>P3 — drop the {@code WHERE … version <} guard from {@code projeterVersion}: v1 after v2
 *       leaves v1's structure → red.</li>
 * </ul>
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class ProgressionCoursConcurrenceIntegrationTest {

    @Autowired ProgressionCoursService cours;
    @Autowired ProgressionService progression;
    @Autowired JdbcTemplate jdbc;
    @Autowired TransactionTemplate tx;

    /** P1 — two tabs (or a double trigger) mark the same section read at once. */
    @Test
    void givenTwoTabsWhenTheSameSectionIsMarkedReadAtOnceThenOneRowOneAwardNoError() throws Exception {
        UUID eleve = UUID.randomUUID();
        UUID coursId = UUID.randomUUID();
        cours.enregistrerCours(new CoursPublie(coursId, 1, List.of("a", "b"), List.of()));

        List<Throwable> echecs = enParallele(
                () -> cours.onSectionCoursLue(new SectionCoursLue(eleve, coursId, "a", Instant.now())),
                () -> cours.onSectionCoursLue(new SectionCoursLue(eleve, coursId, "a", Instant.now())));

        assertThat(echecs).as("no thread may fail: its event would stay incomplete").isEmpty();
        assertThat(compter("cours_sections_lues", eleve, coursId)).isEqualTo(1);
        assertThat(xp(eleve, "cours_section")).isEqualTo(2);
        assertThat(progression.pour(eleve).xpTotal()).isEqualTo(2);
    }

    /** P2 — the last section and the last required exercise are processed together. */
    @Test
    void givenTheLastSectionAndLastExerciseAtOnceWhenBothCommitThenTheCourseIsAlwaysDone() throws Exception {
        for (int i = 0; i < 50; i++) {
            UUID eleve = UUID.randomUUID();
            UUID coursId = UUID.randomUUID();
            cours.enregistrerCours(new CoursPublie(coursId, 1, List.of("a", "b"), List.of("e1")));
            cours.onSectionCoursLue(new SectionCoursLue(eleve, coursId, "a", Instant.now())); // follow-up exists

            SoumissionEnregistree solve = new SoumissionEnregistree(eleve, UUID.randomUUID(), UUID.randomUUID(),
                    null, true, 1.0, true, List.of(), null, Instant.now(), coursId, "e1");
            List<Throwable> echecs = enParallele(
                    () -> cours.onSectionCoursLue(new SectionCoursLue(eleve, coursId, "b", Instant.now())),
                    () -> tx.executeWithoutResult(s -> {
                        cours.onSoumission(solve);
                        progression.attribuerPourSoumission(solve);
                    }));

            assertThat(echecs).as("iteration %d", i).isEmpty();
            assertThat(jdbc.queryForObject(
                    "SELECT termine_at IS NOT NULL FROM progression.cours_suivis WHERE eleve_id = ? AND cours_id = ?",
                    Boolean.class, eleve, coursId))
                    .as("iteration %d: completion must not be lost to a write skew", i).isTrue();
        }
    }

    /** P3 — two publications delivered concurrently: the newer one wins. */
    @Test
    void givenTwoVersionsProjectedAtOnceThenTheProjectionIsTheNewerOne() throws Exception {
        for (int i = 0; i < 20; i++) {
            UUID coursId = UUID.randomUUID();
            List<Throwable> echecs = enParallele(
                    () -> cours.enregistrerCours(new CoursPublie(coursId, 1, List.of("a", "b", "c"), List.of("e1"))),
                    () -> cours.enregistrerCours(new CoursPublie(coursId, 2, List.of("a"), List.of())));

            assertThat(echecs).as("iteration %d", i).isEmpty();
            assertThat(jdbc.queryForObject("SELECT version FROM progression.cours WHERE cours_id = ?",
                    Integer.class, coursId)).isEqualTo(2);
            assertThat(jdbc.queryForList("SELECT cle FROM progression.cours_elements WHERE cours_id = ?",
                    String.class, coursId)).as("iteration %d", i).containsExactly("a");
        }
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private static List<Throwable> enParallele(Runnable... taches) throws Exception {
        List<Throwable> echecs = new CopyOnWriteArrayList<>();
        CyclicBarrier depart = new CyclicBarrier(taches.length);
        ExecutorService pool = Executors.newFixedThreadPool(taches.length);
        try {
            List<Future<?>> futures = new ArrayList<>();
            for (Runnable tache : taches) {
                futures.add(pool.submit(() -> {
                    try {
                        depart.await();
                        tache.run();
                    } catch (Throwable t) {
                        echecs.add(t);
                    }
                }));
            }
            for (Future<?> f : futures) {
                f.get();
            }
        } finally {
            pool.shutdownNow();
        }
        return echecs;
    }

    private int compter(String table, UUID eleve, UUID coursId) {
        return jdbc.queryForObject("SELECT count(*) FROM progression." + table + " WHERE eleve_id = ? AND cours_id = ?",
                Integer.class, eleve, coursId);
    }

    private int xp(UUID eleve, String sourceType) {
        return jdbc.queryForObject(
                "SELECT coalesce(sum(points), 0) FROM progression.evenements_xp WHERE eleve_id = ? AND source_type = ?",
                Integer.class, eleve, sourceType);
    }
}
