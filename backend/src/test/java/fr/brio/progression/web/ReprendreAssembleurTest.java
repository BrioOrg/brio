package fr.brio.progression.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.brio.contenu.api.CoursAccesApi;
import fr.brio.progression.ProgressionCoursService;
import fr.brio.progression.ProgressionCoursService.CoursEnCours;
import fr.brio.progression.ProgressionService;
import fr.brio.progression.api.ChapitreAReprendre;
import fr.brio.progression.api.ContenuAReprendre;
import fr.brio.progression.api.CoursAReprendre;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** « Reprendre » between a chapter and a teacher course (ADR 0050 §5, C10, C11). */
class ReprendreAssembleurTest {

    private static final Instant T = Instant.parse("2026-11-23T10:00:00Z");

    private final UUID eleve = UUID.randomUUID();
    private final UUID coursA = UUID.randomUUID();
    private final UUID coursB = UUID.randomUUID();

    private ProgressionService progression;
    private ProgressionCoursService progressionCours;
    private CoursAccesApi acces;
    private ReprendreAssembleur assembleur;

    @BeforeEach
    void setup() {
        progression = mock(ProgressionService.class);
        progressionCours = mock(ProgressionCoursService.class);
        acces = mock(CoursAccesApi.class);
        assembleur = new ReprendreAssembleur(progression, progressionCours, acces);
        when(progression.reprendre(eleve)).thenReturn(Optional.empty());
        when(progressionCours.coursEnCours(eleve)).thenReturn(List.of());
    }

    @Test
    void givenNothingInProgressThenNothingAndNoCallToContenu() {
        assertThat(assembleur.reprendre(eleve)).isEmpty();
        verify(acces, never()).titresVisiblesPourEleve(any(), any());
    }

    @Test
    void givenACourseReadAfterTheChapterThenTheCourseWins() {
        when(progression.reprendre(eleve)).thenReturn(Optional.of(chapitre(T)));
        coursEnCours(new CoursEnCours(coursA, 1, 3, T.plusSeconds(1)));
        visibles(Map.of(coursA, "Pythagore"));

        assertThat(assembleur.reprendre(eleve)).get()
                .isEqualTo(new CoursAReprendre(coursA, "Pythagore", 1, 3, T.plusSeconds(1)));
    }

    @Test
    void givenTheChapterReadAfterTheCourseThenTheChapterWins() {
        when(progression.reprendre(eleve)).thenReturn(Optional.of(chapitre(T)));
        coursEnCours(new CoursEnCours(coursA, 1, 3, T.minusSeconds(1)));
        visibles(Map.of(coursA, "Pythagore"));

        assertThat(assembleur.reprendre(eleve)).get().isInstanceOf(ChapitreAReprendre.class);
    }

    @Test
    void givenATieThenTheChapterWins() {
        when(progression.reprendre(eleve)).thenReturn(Optional.of(chapitre(T)));
        coursEnCours(new CoursEnCours(coursA, 1, 3, T));
        visibles(Map.of(coursA, "Pythagore"));

        assertThat(assembleur.reprendre(eleve)).get().isInstanceOf(ChapitreAReprendre.class);
    }

    @Test
    void givenTheLatestCourseNoLongerVisibleThenTheNextVisibleOneIsProposed() {
        coursEnCours(new CoursEnCours(coursA, 1, 3, T.plusSeconds(10)), new CoursEnCours(coursB, 2, 4, T));
        visibles(Map.of(coursB, "Les fractions"));

        Optional<ContenuAReprendre> r = assembleur.reprendre(eleve);

        assertThat(r).get().isEqualTo(new CoursAReprendre(coursB, "Les fractions", 2, 4, T));
        verify(acces).titresVisiblesPourEleve(eq(eleve), eq(Set.of(coursA, coursB)));
    }

    @Test
    void givenNoVisibleCourseThenTheChapterIfAnyElseNothing() {
        coursEnCours(new CoursEnCours(coursA, 1, 3, T.plusSeconds(10)));
        visibles(Map.of());
        assertThat(assembleur.reprendre(eleve)).isEmpty();

        when(progression.reprendre(eleve)).thenReturn(Optional.of(chapitre(T)));
        assertThat(assembleur.reprendre(eleve)).get().isInstanceOf(ChapitreAReprendre.class);
    }

    @Test
    void givenMoreSectionsReadThanTheVersionHasThenTheBarNeverOverflows() {
        coursEnCours(new CoursEnCours(coursA, 5, 3, T));
        visibles(Map.of(coursA, "Pythagore"));

        assertThat(assembleur.reprendre(eleve)).get()
                .isEqualTo(new CoursAReprendre(coursA, "Pythagore", 3, 3, T));
    }

    private void coursEnCours(CoursEnCours... cours) {
        when(progressionCours.coursEnCours(eleve)).thenReturn(List.of(cours));
    }

    private void visibles(Map<UUID, String> titres) {
        when(acces.titresVisiblesPourEleve(eq(eleve), any())).thenReturn(titres);
    }

    private static ChapitreAReprendre chapitre(Instant quand) {
        return new ChapitreAReprendre("les-fractions", "Les fractions", "5e", "mathematiques", 1, 4, quand);
    }
}
