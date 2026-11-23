package fr.brio.progression;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyShort;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import fr.brio.exercices.api.SoumissionEnregistree;
import fr.brio.progression.infrastructure.CoursProgressionRepository;
import fr.brio.progression.infrastructure.CoursProgressionRepository.Faits;
import fr.brio.progression.infrastructure.CoursProgressionRepository.Structure;
import fr.brio.progression.infrastructure.EvenementXpRepository;
import fr.brio.progression.infrastructure.SerieRepository;
import fr.brio.progression.infrastructure.SoldeRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Rules of course progression without a database (ADR 0050 §5); races are in the integration tests. */
class ProgressionCoursServiceTest {

    private final UUID eleve = UUID.randomUUID();
    private final UUID coursId = UUID.randomUUID();

    private CoursProgressionRepository cours;
    private EvenementXpRepository evenements;
    private ProgressionCoursService service;

    @BeforeEach
    void setup() {
        cours = mock(CoursProgressionRepository.class);
        evenements = mock(EvenementXpRepository.class);
        service = new ProgressionCoursService(cours, evenements, mock(SoldeRepository.class), mock(SerieRepository.class));
    }

    // ── completion and percentage ─────────────────────────────────────────────

    @Test
    void givenAllSectionsReadThenDoneExactlyFromEightyPercentOfExercises() {
        Structure s = new Structure(2, 5);
        assertThat(ProgressionCoursService.conditionTerminee(s, new Faits(2, 3, false))).isFalse();
        assertThat(ProgressionCoursService.conditionTerminee(s, new Faits(2, 4, false))).isTrue();
        assertThat(ProgressionCoursService.conditionTerminee(s, new Faits(1, 5, false))).as("a section left").isFalse();
    }

    @Test
    void givenNoExerciseThenAllSectionsAreEnoughAndNoSectionIsNeverDone() {
        assertThat(ProgressionCoursService.conditionTerminee(new Structure(2, 0), new Faits(2, 0, false))).isTrue();
        assertThat(ProgressionCoursService.conditionTerminee(new Structure(0, 0), new Faits(0, 0, false))).isFalse();
    }

    @Test
    void percentageCountsSectionsAndExercisesAndReadsHundredOnceDone() {
        assertThat(ProgressionCoursService.pourcentage(new Structure(4, 0), new Faits(2, 0, false), false)).isEqualTo(50);
        assertThat(ProgressionCoursService.pourcentage(new Structure(2, 1), new Faits(1, 0, false), false)).isEqualTo(33);
        assertThat(ProgressionCoursService.pourcentage(new Structure(2, 2), new Faits(1, 0, false), true)).isEqualTo(100);
        assertThat(ProgressionCoursService.pourcentage(new Structure(0, 0), new Faits(0, 0, false), false)).isZero();
        assertThat(ProgressionCoursService.pourcentage(new Structure(2, 0), new Faits(5, 0, false), false))
                .as("never above 100").isEqualTo(100);
    }

    // ── gauge ─────────────────────────────────────────────────────────────────

    @Test
    void givenNoRowOfTheStudentThenNoGaugeEvenForAProjectedCourse() {
        when(cours.structure(coursId)).thenReturn(Optional.of(new Structure(3, 0)));
        when(cours.aDesLignes(eleve, coursId)).thenReturn(false);

        assertThat(service.jauge(eleve, coursId)).isEmpty();
        verify(cours, never()).faits(any(), any());
    }

    @Test
    void givenAnUnprojectedCourseThenNoGauge() {
        when(cours.structure(coursId)).thenReturn(Optional.empty());
        assertThat(service.jauge(eleve, coursId)).isEmpty();
    }

    @Test
    void givenRowsThenTheGaugeIsTheStudentsFactsAgainstTheCurrentVersion() {
        when(cours.structure(coursId)).thenReturn(Optional.of(new Structure(4, 0)));
        when(cours.aDesLignes(eleve, coursId)).thenReturn(true);
        when(cours.faits(eleve, coursId)).thenReturn(new Faits(1, 0, false));

        assertThat(service.jauge(eleve, coursId)).get()
                .satisfies(j -> {
                    assertThat(j.pourcentage()).isEqualTo(25);
                    assertThat(j.sectionsLues()).isEqualTo(1);
                    assertThat(j.sectionsTotal()).isEqualTo(4);
                    assertThat(j.termine()).isFalse();
                });
    }

    // ── submissions ───────────────────────────────────────────────────────────

    @Test
    void givenAMissOrAChapterSubmissionThenNothingIsRecordedForACourse() {
        service.enregistrerReussite(soumission(false, coursId, "e1"));
        service.enregistrerReussite(soumission(true, null, null));
        service.enregistrerReussite(soumission(true, coursId, null));
        service.attribuerXpReussite(soumission(false, coursId, "e1"));
        verifyNoInteractions(cours);
    }

    @Test
    void givenASolveAlreadyRewardedUnderItsUuidThenNoCourseXp() {
        SoumissionEnregistree e = soumission(true, coursId, "e1");
        when(evenements.existsByEleveIdAndSourceTypeAndSourceRef(eleve, "exercice", e.exerciceId().toString()))
                .thenReturn(true);

        service.attribuerXpReussite(e);

        verify(cours, never()).insererXp(any(), anyString(), anyString(), anyString(), anyShort(), any());
    }

    @Test
    void givenTheKeyAlreadyRewardedThenNoSecondAward() {
        when(evenements.existsByEleveIdAndSourceTypeAndSourceRef(eleve, "cours_exercice", coursId + "/e1"))
                .thenReturn(true);

        service.attribuerXpReussite(soumission(true, coursId, "e1"));

        verify(cours, never()).insererXp(any(), anyString(), anyString(), anyString(), anyShort(), any());
    }

    @Test
    void givenAFirstTrySolveThenTenXpUnderTheStableKey() {
        service.attribuerXpReussite(soumission(true, coursId, "e1"));

        verify(cours).insererXp(eq(eleve), eq("cours_exercice"), eq(coursId + "/e1"), eq("reussi_1er_coup"),
                eq((short) 10), any());
    }

    private SoumissionEnregistree soumission(boolean correct, UUID cours, String cle) {
        return new SoumissionEnregistree(eleve, UUID.randomUUID(), UUID.randomUUID(), null, correct, correct ? 1 : 0,
                true, List.of(), null, Instant.now(), cours, cle);
    }
}
