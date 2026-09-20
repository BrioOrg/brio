package fr.brio.progression;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.brio.contenu.api.SectionTerminee;
import fr.brio.exercices.api.SoumissionEnregistree;
import fr.brio.progression.api.SerieInfo;
import fr.brio.progression.domain.Serie;
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
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

class ProgressionSerieTest {

    private EvenementXpRepository evenements;
    private SerieRepository series;
    private ProgressionService service;

    private final UUID eleve = UUID.randomUUID();
    private final UUID exo = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        evenements = mock(EvenementXpRepository.class);
        series = mock(SerieRepository.class);
        service = new ProgressionService(
                evenements,
                mock(SoldeRepository.class),
                mock(ChapitreProjectionRepository.class),
                mock(SectionLueRepository.class),
                mock(ExerciceReussiRepository.class),
                series,
                mock(SoumissionCompetenceRepository.class),
                mock(MaitriseRepository.class),
                mock(ApplicationEventPublisher.class));
        when(evenements.existsByEleveIdAndSourceTypeAndSourceRef(any(), any(), any())).thenReturn(false);
        when(evenements.sommePointsDepuis(any(), any())).thenReturn(0);
        when(series.findById(eleve)).thenReturn(Optional.empty()); // first activity by default
    }

    private SoumissionEnregistree soumission(boolean correct) {
        return new SoumissionEnregistree(
                eleve, exo, UUID.randomUUID(), null, correct, correct ? 1.0 : 0.0, true, List.of(), Instant.now());
    }

    @Test
    void uneBonneSoumissionEnregistreLActivite() {
        service.attribuerPourSoumission(soumission(true));

        ArgumentCaptor<Serie> captor = ArgumentCaptor.forClass(Serie.class);
        verify(series).save(captor.capture());
        assertThat(captor.getValue().getDernierJourActif()).isNotNull();
        assertThat(captor.getValue().getJoursConsecutifs()).isEqualTo((short) 1);
    }

    @Test
    void uneMauvaiseSoumissionCompteAussiPourLaSerie() {
        service.attribuerPourSoumission(soumission(false));

        // No XP for a wrong answer, but the day still counts as activity (#95).
        verify(evenements, org.mockito.Mockito.never()).save(any());
        verify(series).save(any(Serie.class));
    }

    @Test
    void uneSectionLueEnregistreLActivite() {
        service.onSectionTerminee(new SectionTerminee(eleve, "chap", "intro", Instant.now()));

        verify(series).save(any(Serie.class));
    }

    @Test
    void serieRenvoieZeroQuandAucuneActivite() {
        assertThat(service.serie(eleve)).isEqualTo(new SerieInfo(0, null, Serie.GELS_PAR_SEMAINE, false));
    }

    @Test
    void serieRenvoieLaValeurVivante() {
        LocalDate aujourdhui = LocalDate.now(ProgressionService.ZONE);
        Serie active = new Serie(eleve);
        active.enregistrerActivite(aujourdhui, Instant.now());
        when(series.findById(eleve)).thenReturn(Optional.of(active));

        SerieInfo info = service.serie(eleve);

        assertThat(info.joursConsecutifs()).isEqualTo(1);
        assertThat(info.actifAujourdhui()).isTrue();
        assertThat(info.dernierJourActif()).isEqualTo(aujourdhui);
    }
}
