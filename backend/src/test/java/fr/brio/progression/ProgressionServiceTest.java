package fr.brio.progression;

import fr.brio.exercices.api.SoumissionEnregistree;
import fr.brio.progression.api.ProgressionInfo;
import fr.brio.progression.domain.EvenementXp;
import fr.brio.progression.domain.Solde;
import fr.brio.progression.infrastructure.ChapitreProjectionRepository;
import fr.brio.progression.infrastructure.EvenementXpRepository;
import fr.brio.progression.infrastructure.ExerciceReussiRepository;
import fr.brio.progression.infrastructure.MaitriseRepository;
import fr.brio.progression.infrastructure.SectionLueRepository;
import fr.brio.progression.infrastructure.SerieRepository;
import fr.brio.progression.infrastructure.SoldeRepository;
import fr.brio.progression.infrastructure.SoumissionCompetenceRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProgressionServiceTest {

    private EvenementXpRepository evenements;
    private SoldeRepository soldes;
    private ChapitreProjectionRepository chapitres;
    private SectionLueRepository sectionsLues;
    private ExerciceReussiRepository exercicesReussis;
    private SerieRepository series;
    private ProgressionService service;

    private final UUID eleve = UUID.randomUUID();
    private final UUID exo = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        evenements = mock(EvenementXpRepository.class);
        soldes = mock(SoldeRepository.class);
        chapitres = mock(ChapitreProjectionRepository.class);
        sectionsLues = mock(SectionLueRepository.class);
        exercicesReussis = mock(ExerciceReussiRepository.class);
        series = mock(SerieRepository.class);
        service = new ProgressionService(evenements, soldes, chapitres, sectionsLues, exercicesReussis, series,
                mock(SoumissionCompetenceRepository.class), mock(MaitriseRepository.class),
                mock(ApplicationEventPublisher.class));
        // Defaults: no prior XP for this exercise, cap not reached.
        when(evenements.existsByEleveIdAndSourceTypeAndSourceRef(any(), any(), any())).thenReturn(false);
        when(evenements.sommePointsDepuis(any(), any())).thenReturn(0);
    }

    // chapitreId = null keeps these tests focused on the exercise-XP path; completion
    // tracking (which needs the chapter projection) is covered in ProgressionCompletionTest.
    private SoumissionEnregistree soumission(boolean correct, boolean premiereTentative) {
        return new SoumissionEnregistree(
                eleve, exo, UUID.randomUUID(), null, correct, correct ? 1.0 : 0.0,
                premiereTentative, List.of(), null, Instant.now());
    }

    @Test
    void reussiDuPremierCoupDonne10() {
        when(evenements.sommePointsPourEleve(eleve)).thenReturn(10);

        service.attribuerPourSoumission(soumission(true, true));

        ArgumentCaptor<EvenementXp> captor = ArgumentCaptor.forClass(EvenementXp.class);
        verify(evenements).save(captor.capture());
        assertThat(captor.getValue().getPoints()).isEqualTo((short) 10);
        assertThat(captor.getValue().getMotif()).isEqualTo("reussi_1er_coup");
    }

    @Test
    void reussiApresErreurDonne6() {
        when(evenements.sommePointsPourEleve(eleve)).thenReturn(6);

        service.attribuerPourSoumission(soumission(true, false));

        ArgumentCaptor<EvenementXp> captor = ArgumentCaptor.forClass(EvenementXp.class);
        verify(evenements).save(captor.capture());
        assertThat(captor.getValue().getPoints()).isEqualTo((short) 6);
        assertThat(captor.getValue().getMotif()).isEqualTo("reussi_apres_erreur");
    }

    @Test
    void mauvaiseReponseNeDonneRien() {
        service.attribuerPourSoumission(soumission(false, true));
        verify(evenements, never()).save(any());
        verify(soldes, never()).save(any());
    }

    @Test
    void unExerciceDejaRecompenseNeReDonnePas() {
        when(evenements.existsByEleveIdAndSourceTypeAndSourceRef(eleve, "exercice", exo.toString()))
                .thenReturn(true);

        service.attribuerPourSoumission(soumission(true, false));

        verify(evenements, never()).save(any());
    }

    @Test
    void plafondQuotidienBloqueLAttribution() {
        when(evenements.sommePointsDepuis(any(), any())).thenReturn(200);

        service.attribuerPourSoumission(soumission(true, true));

        verify(evenements, never()).save(any());
    }

    @Test
    void recalculeLeSoldeEtLeNiveauApresAttribution() {
        when(evenements.sommePointsPourEleve(eleve)).thenReturn(400);

        service.attribuerPourSoumission(soumission(true, true));

        ArgumentCaptor<Solde> captor = ArgumentCaptor.forClass(Solde.class);
        verify(soldes).save(captor.capture());
        assertThat(captor.getValue().getXpTotal()).isEqualTo(400);
        assertThat(captor.getValue().getNiveau()).isEqualTo((short) 2);
    }

    @Test
    void pourRetourneZeroQuandAucunSolde() {
        when(soldes.findById(eleve)).thenReturn(Optional.empty());
        assertThat(service.pour(eleve)).isEqualTo(new ProgressionInfo(0, 0));
    }

    @Test
    void pourRetourneLeSoldeExistant() {
        when(soldes.findById(eleve)).thenReturn(Optional.of(new Solde(eleve, 400, (short) 2, Instant.now())));
        assertThat(service.pour(eleve)).isEqualTo(new ProgressionInfo(400, 2));
    }
}
