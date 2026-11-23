package fr.brio;

import static org.assertj.core.api.Assertions.assertThat;

import fr.brio.contenu.api.CoursPublie;
import fr.brio.contenu.api.SectionCoursLue;
import fr.brio.exercices.api.SoumissionEnregistree;
import fr.brio.progression.ProgressionCoursService;
import fr.brio.progression.ProgressionService;
import fr.brio.progression.api.ProgressionCoursInfo;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Rules of teacher-course progression on a real Postgres (ADR 0050 §4-§6): gauge, sticky
 * completion, republication by stable keys, XP without completion bonus, and isolation between
 * students. Each test uses fresh ids, so no cleanup is needed.
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class ProgressionCoursIntegrationTest {

    @Autowired ProgressionCoursService cours;
    @Autowired ProgressionService progression;
    @Autowired JdbcTemplate jdbc;
    @Autowired TransactionTemplate tx;

    private final UUID eleve = UUID.randomUUID();
    private final UUID coursId = UUID.randomUUID();

    // ── C7 / C8 : jauge et complétion ─────────────────────────────────────────

    @Test
    void givenTwoOfFourSectionsReadWhenGaugeIsReadThenItShowsHalfTheSections() {
        cours.enregistrerCours(publie(1, List.of("a", "b", "c", "d"), List.of()));
        lire("a");
        lire("b");

        ProgressionCoursInfo jauge = cours.jauge(eleve, coursId).orElseThrow();

        assertThat(jauge.pourcentage()).isEqualTo(50);
        assertThat(jauge.sectionsLues()).isEqualTo(2);
        assertThat(jauge.sectionsTotal()).isEqualTo(4);
        assertThat(jauge.termine()).isFalse();
    }

    @Test
    void givenAllSectionsAndEightyPercentOfExercisesWhenTheLastFactLandsThenTheCourseIsDone() {
        cours.enregistrerCours(publie(1, List.of("a", "b"), List.of("e1", "e2", "e3", "e4", "e5")));
        lire("a");
        lire("b");
        for (String cle : List.of("e1", "e2", "e3")) {
            soumettre(UUID.randomUUID(), cle, true);
        }
        assertThat(cours.jauge(eleve, coursId).orElseThrow().termine()).as("3/5 < 80 %").isFalse();

        soumettre(UUID.randomUUID(), "e4", true);

        ProgressionCoursInfo jauge = cours.jauge(eleve, coursId).orElseThrow();
        assertThat(jauge.termine()).isTrue();
        assertThat(jauge.pourcentage()).isEqualTo(100);
        assertThat(termineAt()).as("completion is stored, sticky").isNotNull();
    }

    // ── C9 : republication ────────────────────────────────────────────────────

    @Test
    void givenAGaugeWhenTheTeacherRepublishesTheSameStructureThenTheGaugeIsUnchanged() {
        cours.enregistrerCours(publie(1, List.of("a", "b", "c", "d"), List.of("e1")));
        lire("a");
        soumettre(UUID.randomUUID(), "e1", true); // v1 exercise UUID
        int avant = cours.jauge(eleve, coursId).orElseThrow().pourcentage();

        cours.enregistrerCours(publie(2, List.of("a", "b", "c", "d"), List.of("e1"))); // new UUIDs, same keys

        assertThat(cours.jauge(eleve, coursId).orElseThrow().pourcentage()).isEqualTo(avant).isEqualTo(40);
    }

    @Test
    void givenADoneCourseWhenTheTeacherAddsASectionThenItStaysDone() {
        cours.enregistrerCours(publie(1, List.of("a"), List.of()));
        lire("a");
        assertThat(cours.jauge(eleve, coursId).orElseThrow().termine()).isTrue();

        cours.enregistrerCours(publie(2, List.of("a", "b"), List.of()));

        ProgressionCoursInfo jauge = cours.jauge(eleve, coursId).orElseThrow();
        assertThat(jauge.termine()).isTrue();
        assertThat(jauge.pourcentage()).isEqualTo(100);
        assertThat(jauge.sectionsLues()).isEqualTo(1);
    }

    @Test
    void givenAnAddedSectionWhenTheGaugeIsReadThenItDropsHonestlyButSectionsReadDoNot() {
        cours.enregistrerCours(publie(1, List.of("a", "b", "c", "d"), List.of()));
        lire("a");
        lire("b");

        cours.enregistrerCours(publie(2, List.of("a", "b", "c", "d", "e"), List.of()));

        ProgressionCoursInfo jauge = cours.jauge(eleve, coursId).orElseThrow();
        assertThat(jauge.sectionsLues()).isEqualTo(2);
        assertThat(jauge.sectionsTotal()).isEqualTo(5);
        assertThat(jauge.pourcentage()).isEqualTo(40);
    }

    // ── P3 : projection gardée par la version ─────────────────────────────────

    @Test
    void givenVersionTwoProjectedWhenVersionOneArrivesLateThenTheProjectionKeepsVersionTwo() {
        cours.enregistrerCours(publie(2, List.of("a", "b"), List.of()));
        cours.enregistrerCours(publie(1, List.of("a", "b", "c"), List.of("e1")));

        assertThat(jdbc.queryForObject("SELECT version FROM progression.cours WHERE cours_id = ?",
                Integer.class, coursId)).isEqualTo(2);
        assertThat(elements("section")).containsExactlyInAnyOrder("a", "b");
        assertThat(elements("exercice")).isEmpty();
    }

    // ── P4 : une section retirée n'est plus comptée ───────────────────────────

    @Test
    void givenASectionRemovedByVersionTwoWhenItsReadArrivesAfterThenItIsStoredButNotCounted() {
        cours.enregistrerCours(publie(1, List.of("a", "s"), List.of()));
        cours.enregistrerCours(publie(2, List.of("a", "b"), List.of()));

        lire("a");
        lire("s");

        ProgressionCoursInfo jauge = cours.jauge(eleve, coursId).orElseThrow();
        assertThat(jauge.sectionsLues()).isEqualTo(1);
        assertThat(jauge.sectionsTotal()).isEqualTo(2);
    }

    // ── S2 : la projection ne touche jamais aux faits d'un élève ──────────────

    @Test
    void givenADoneCourseWhenAVersionDroppingElementsIsAnnouncedThenNoStudentFactChanges() {
        cours.enregistrerCours(publie(1, List.of("a", "b"), List.of("e1")));
        lire("a");
        lire("b");
        soumettre(UUID.randomUUID(), "e1", true);
        Instant termine = termineAt();
        int xp = xpDe(eleve);
        int lignes = compter("cours_sections_lues") + compter("cours_exercices_reussis");

        cours.enregistrerCours(publie(2, List.of("c"), List.of()));
        cours.enregistrerCours(publie(2, List.of("c"), List.of())); // startup re-announcement

        assertThat(termineAt()).isEqualTo(termine);
        assertThat(xpDe(eleve)).isEqualTo(xp);
        assertThat(compter("cours_sections_lues") + compter("cours_exercices_reussis")).isEqualTo(lignes);
    }

    // ── P6 et XP ──────────────────────────────────────────────────────────────

    @Test
    void givenTheSameExerciseSolvedOnTwoVersionsThenItIsOneSolveAndOneAward() {
        cours.enregistrerCours(publie(2, List.of("a"), List.of("e1")));
        soumettre(UUID.randomUUID(), "e1", true); // v1 UUID, tab left open
        soumettre(UUID.randomUUID(), "e1", true); // v2 UUID

        assertThat(compter("cours_exercices_reussis")).isEqualTo(1);
        assertThat(xp("cours_exercice")).isEqualTo(10);
    }

    @Test
    void givenACourseWhenItIsCompletedThenSectionsAndExercisesEarnXpAndThereIsNoBonus() {
        cours.enregistrerCours(publie(1, List.of("a", "b"), List.of("e1")));
        lire("a");
        lire("a"); // double signal
        lire("b");
        soumettre(UUID.randomUUID(), "e1", false); // a miss costs nothing
        soumettre(UUID.randomUUID(), "e1", true);  // solved after an error: +6

        assertThat(xp("cours_section")).isEqualTo(4);
        assertThat(xp("cours_exercice")).isEqualTo(6);
        assertThat(xpDe(eleve)).as("no completion bonus").isEqualTo(10);
        assertThat(progression.pour(eleve).xpTotal()).isEqualTo(10);
        assertThat(cours.jauge(eleve, coursId).orElseThrow().termine()).isTrue();
    }

    @Test
    void givenTheDailyCapReachedWhenACourseSectionIsReadThenItCountsButEarnsNothing() {
        jdbc.update("""
                INSERT INTO progression.evenements_xp (id, eleve_id, source_type, source_ref, motif, points, created_at)
                VALUES (gen_random_uuid(), ?, 'exercice', ?, 'reussi_1er_coup', 200, now())""",
                eleve, UUID.randomUUID().toString());
        cours.enregistrerCours(publie(1, List.of("a", "b"), List.of()));

        lire("a");

        assertThat(xp("cours_section")).as("course sections count toward the cap").isZero();
        assertThat(cours.jauge(eleve, coursId).orElseThrow().sectionsLues()).isEqualTo(1);

        // The next day (the capped award is gone from today's sum), the same section read earns it,
        // as a chapter exercise solved again would.
        jdbc.update("UPDATE progression.evenements_xp SET created_at = now() - interval '2 days' "
                + "WHERE eleve_id = ? AND source_type = 'exercice'", eleve);
        lire("a");
        assertThat(xp("cours_section")).isEqualTo(2);
        lire("a");
        assertThat(xp("cours_section")).as("still once per section").isEqualTo(2);
    }

    @Test
    void givenAnExerciseAlreadyRewardedUnderItsUuidWhenSolvedAgainThenNoSecondAward() {
        UUID exerciceId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO progression.evenements_xp (id, eleve_id, source_type, source_ref, motif, points, created_at)
                VALUES (gen_random_uuid(), ?, 'exercice', ?, 'reussi_1er_coup', 10, now())""",
                eleve, exerciceId.toString());
        cours.enregistrerCours(publie(1, List.of("a"), List.of("e1")));

        soumettre(exerciceId, "e1", true);

        assertThat(xp("cours_exercice")).isZero();
        assertThat(compter("cours_exercices_reussis")).as("the solve still counts in the gauge").isEqualTo(1);
    }

    @Test
    void givenACourseSubmissionWhenProgressionAttributesItThenNoUuidKeyedAwardIsMade() {
        tx.executeWithoutResult(s -> progression.attribuerPourSoumission(soumission(UUID.randomUUID(), "e1", true)));

        assertThat(xp("exercice")).as("the per-version UUID key is not used for a course").isZero();
    }

    // ── C12 : chacun ses lignes ───────────────────────────────────────────────

    @Test
    void givenAStudentWithoutAnyRowWhenTheyReadTheGaugeThenThereIsNone() {
        cours.enregistrerCours(publie(1, List.of("a", "b"), List.of()));
        lire("a");

        UUID autre = UUID.randomUUID();
        assertThat(cours.jauge(autre, coursId)).isEmpty();
        assertThat(cours.jauge(eleve, UUID.randomUUID())).as("unprojected course").isEmpty();
    }

    @Test
    void givenAProjectedCourseWhenNothingWasReadThenItIsNotInProgress() {
        cours.enregistrerCours(publie(1, List.of("a", "b"), List.of()));
        assertThat(cours.coursEnCours(eleve)).isEmpty();

        lire("a");
        assertThat(cours.coursEnCours(eleve)).singleElement()
                .satisfies(c -> assertThat(c.sectionsLues()).isEqualTo(1));

        lire("b");
        assertThat(cours.coursEnCours(eleve)).as("a done course is never resumed").isEmpty();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private CoursPublie publie(int version, List<String> sections, List<String> exercices) {
        return new CoursPublie(coursId, version, sections, exercices);
    }

    private void lire(String section) {
        cours.onSectionCoursLue(new SectionCoursLue(eleve, coursId, section, Instant.now()));
    }

    /** Same three steps as the listener, in one transaction: course solve, streak and mastery, XP. */
    private void soumettre(UUID exerciceId, String cle, boolean correct) {
        SoumissionEnregistree e = soumission(exerciceId, cle, correct);
        tx.executeWithoutResult(s -> {
            cours.enregistrerReussite(e);
            progression.attribuerPourSoumission(e);
            cours.attribuerXpReussite(e);
        });
    }

    /** First attempt unless this test already submitted a wrong answer. */
    private SoumissionEnregistree soumission(UUID exerciceId, String cle, boolean correct) {
        boolean premiere = !dejaRate;
        if (!correct) {
            dejaRate = true;
        }
        return new SoumissionEnregistree(eleve, exerciceId, UUID.randomUUID(), null, correct, correct ? 1.0 : 0.0,
                premiere, List.of(), null, Instant.now(), coursId, cle);
    }

    private boolean dejaRate;

    private Instant termineAt() {
        return Optional.ofNullable(jdbc.queryForObject(
                        "SELECT termine_at FROM progression.cours_suivis WHERE eleve_id = ? AND cours_id = ?",
                        java.sql.Timestamp.class, eleve, coursId))
                .map(java.sql.Timestamp::toInstant).orElse(null);
    }

    private List<String> elements(String nature) {
        return jdbc.queryForList("SELECT cle FROM progression.cours_elements WHERE cours_id = ? AND nature = ?",
                String.class, coursId, nature);
    }

    private int compter(String table) {
        return jdbc.queryForObject("SELECT count(*) FROM progression." + table + " WHERE eleve_id = ? AND cours_id = ?",
                Integer.class, eleve, coursId);
    }

    private int xp(String sourceType) {
        return jdbc.queryForObject(
                "SELECT coalesce(sum(points), 0) FROM progression.evenements_xp WHERE eleve_id = ? AND source_type = ?",
                Integer.class, eleve, sourceType);
    }

    private int xpDe(UUID id) {
        return jdbc.queryForObject("SELECT coalesce(sum(points), 0) FROM progression.evenements_xp WHERE eleve_id = ?",
                Integer.class, id);
    }
}
