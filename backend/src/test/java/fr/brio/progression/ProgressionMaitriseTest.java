package fr.brio.progression;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.brio.exercices.api.SoumissionEnregistree;
import fr.brio.progression.api.MaitriseInfo;
import fr.brio.progression.domain.Maitrise;
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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

class ProgressionMaitriseTest {

    private EvenementXpRepository evenements;
    private SoumissionCompetenceRepository soumissionsCompetences;
    private MaitriseRepository maitrises;
    private ProgressionService service;

    private final UUID eleve = UUID.randomUUID();
    private final UUID exo = UUID.randomUUID();
    private static final String COMP_X = "c3.num.decimaux.comparer-ordonner";
    private static final String COMP_Y = "c3.num.fractions.comparer-ordonner";

    @BeforeEach
    void setUp() {
        evenements = mock(EvenementXpRepository.class);
        soumissionsCompetences = mock(SoumissionCompetenceRepository.class);
        maitrises = mock(MaitriseRepository.class);
        service = new ProgressionService(
                evenements,
                mock(SoldeRepository.class),
                mock(ChapitreProjectionRepository.class),
                mock(SectionLueRepository.class),
                mock(ExerciceReussiRepository.class),
                mock(SerieRepository.class),
                soumissionsCompetences,
                maitrises,
                mock(ApplicationEventPublisher.class));
        when(evenements.existsByEleveIdAndSourceTypeAndSourceRef(any(), any(), any())).thenReturn(false);
        when(evenements.sommePointsDepuis(any(), any())).thenReturn(0);
    }

    private SoumissionEnregistree soumission(
            UUID soumissionId, boolean correct, boolean premiere, List<String> competences) {
        return soumission(soumissionId, correct, premiere, competences, null);
    }

    private SoumissionEnregistree soumission(
            UUID soumissionId, boolean correct, boolean premiere, List<String> competences, String difficulte) {
        return new SoumissionEnregistree(
                eleve, exo, soumissionId, null, correct, correct ? 1.0 : 0.0,
                premiere, competences, difficulte, Instant.now());
    }

    private SoumissionCompetence rows(String code, boolean correct) {
        return rows(code, correct, null);
    }

    private SoumissionCompetence rows(String code, boolean correct, String difficulte) {
        return new SoumissionCompetence(eleve, UUID.randomUUID(), code, correct,
                correct ? 1.0 : 0.0, true, difficulte, Instant.now());
    }

    // ── recording from the event ────────────────────────────────────────────

    @Test
    void uneMauvaiseReponseCompteAussiPourLaMaitrise() {
        // Recorded before the "an error costs nothing" early return: a miss is a sample too.
        service.attribuerPourSoumission(soumission(UUID.randomUUID(), false, true, List.of(COMP_X)));

        ArgumentCaptor<SoumissionCompetence> captor = ArgumentCaptor.forClass(SoumissionCompetence.class);
        verify(soumissionsCompetences).save(captor.capture());
        assertThat(captor.getValue().isCorrect()).isFalse();
        assertThat(captor.getValue().getCompetenceCode()).isEqualTo(COMP_X);
    }

    @Test
    void chaqueCompetenceDeLaSoumissionEstEnregistree() {
        service.attribuerPourSoumission(soumission(UUID.randomUUID(), true, true, List.of(COMP_X, COMP_Y)));

        ArgumentCaptor<SoumissionCompetence> captor = ArgumentCaptor.forClass(SoumissionCompetence.class);
        verify(soumissionsCompetences, org.mockito.Mockito.times(2)).save(captor.capture());
        assertThat(captor.getAllValues()).extracting(SoumissionCompetence::getCompetenceCode)
                .containsExactlyInAnyOrder(COMP_X, COMP_Y);
    }

    @Test
    void uneRedelivraisonNeReEnregistrePasLaSoumission() {
        UUID soumissionId = UUID.randomUUID();
        when(soumissionsCompetences.existsBySoumissionIdAndCompetenceCode(soumissionId, COMP_X)).thenReturn(true);

        service.attribuerPourSoumission(soumission(soumissionId, true, true, List.of(COMP_X)));

        verify(soumissionsCompetences, never()).save(any());
    }

    @Test
    void unEvenementLegacySansSoumissionIdNAlimentePasLaMaitrise() {
        service.attribuerPourSoumission(soumission(null, true, true, List.of(COMP_X)));

        verify(soumissionsCompetences, never()).save(any());
        verify(maitrises, never()).save(any());
    }

    // ── recompute from the stored projection ──────────────────────────────────

    @Test
    void recalculerReconstruitLaMaitriseDepuisLesSoumissions() {
        when(soumissionsCompetences.competencesDeLEleve(eleve)).thenReturn(List.of(COMP_X));
        List<SoumissionCompetence> fenetre = new ArrayList<>();
        for (int i = 0; i < 4; i++) fenetre.add(rows(COMP_X, true));
        fenetre.add(rows(COMP_X, false)); // 4/5 = 0.8
        when(soumissionsCompetences.fenetre(eq(eleve), eq(COMP_X), any())).thenReturn(fenetre);

        service.recalculer(eleve);

        ArgumentCaptor<Maitrise> captor = ArgumentCaptor.forClass(Maitrise.class);
        verify(maitrises).save(captor.capture());
        assertThat(captor.getValue().getNiveau()).isEqualTo((short) 4);
        assertThat(captor.getValue().getEchantillon()).isEqualTo(5);
    }

    @Test
    void unEchantillonTropFaibleDonneUnNiveauNul() {
        when(soumissionsCompetences.competencesDeLEleve(eleve)).thenReturn(List.of(COMP_X));
        when(soumissionsCompetences.fenetre(eq(eleve), eq(COMP_X), any()))
                .thenReturn(List.of(rows(COMP_X, true), rows(COMP_X, true))); // 2 < seuil

        service.recalculer(eleve);

        ArgumentCaptor<Maitrise> captor = ArgumentCaptor.forClass(Maitrise.class);
        verify(maitrises).save(captor.capture());
        assertThat(captor.getValue().getNiveau()).isNull();
        assertThat(captor.getValue().getEchantillon()).isEqualTo(2);
    }

    @Test
    void laDifficulteEstEnregistreeSurLaProjection() {
        service.attribuerPourSoumission(
                soumission(UUID.randomUUID(), true, true, List.of(COMP_X), "approfondissement"));

        ArgumentCaptor<SoumissionCompetence> captor = ArgumentCaptor.forClass(SoumissionCompetence.class);
        verify(soumissionsCompetences).save(captor.capture());
        assertThat(captor.getValue().getDifficulte()).isEqualTo("approfondissement");
    }

    @Test
    void laDifficultePondereLaMaitrise() {
        // Two easy successes and one hard miss. An unweighted count would read 2/3 ≈ 0.67 → niveau 3;
        // weighted, the hard miss (poids 3) drags the rate to 2/5 = 0.4 → niveau 2 (ADR 0022 §6, #103).
        when(soumissionsCompetences.competencesDeLEleve(eleve)).thenReturn(List.of(COMP_X));
        when(soumissionsCompetences.fenetre(eq(eleve), eq(COMP_X), any())).thenReturn(List.of(
                rows(COMP_X, true, "introduction"),
                rows(COMP_X, true, "introduction"),
                rows(COMP_X, false, "approfondissement")));

        service.recalculer(eleve);

        ArgumentCaptor<Maitrise> captor = ArgumentCaptor.forClass(Maitrise.class);
        verify(maitrises).save(captor.capture());
        assertThat(captor.getValue().getNiveau()).isEqualTo((short) 2);
        assertThat(captor.getValue().getEchantillon()).isEqualTo(3);
    }

    // ── read API ──────────────────────────────────────────────────────────────

    @Test
    void maitriseExposeUnNiveauParCompetenceAvecNiveauNullableSousLeSeuil() {
        when(maitrises.findByIdEleveId(eleve)).thenReturn(List.of(
                new Maitrise(eleve, COMP_X, (short) 3, 6, Instant.now()),
                new Maitrise(eleve, COMP_Y, null, 2, Instant.now())));

        assertThat(service.maitrise(eleve)).containsExactly(
                new MaitriseInfo(COMP_X, 3, 6),
                new MaitriseInfo(COMP_Y, null, 2));
    }
}
