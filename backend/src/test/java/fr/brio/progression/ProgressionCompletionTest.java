package fr.brio.progression;

import fr.brio.contenu.api.SectionTerminee;
import fr.brio.exercices.api.SoumissionEnregistree;
import fr.brio.progression.api.ChapitreTermine;
import fr.brio.progression.api.EtatParcours;
import fr.brio.progression.api.ParcoursChapitre;
import fr.brio.progression.domain.Chapitre;
import fr.brio.progression.domain.EvenementXp;
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

class ProgressionCompletionTest {

    private EvenementXpRepository evenements;
    private SoldeRepository soldes;
    private ChapitreProjectionRepository chapitres;
    private SectionLueRepository sectionsLues;
    private ExerciceReussiRepository exercicesReussis;
    private SerieRepository series;
    private ApplicationEventPublisher events;
    private ProgressionService service;

    private final UUID eleve = UUID.randomUUID();
    private static final String CHAP = "nombres-decimaux-comparer-ranger";

    @BeforeEach
    void setUp() {
        evenements = mock(EvenementXpRepository.class);
        soldes = mock(SoldeRepository.class);
        chapitres = mock(ChapitreProjectionRepository.class);
        sectionsLues = mock(SectionLueRepository.class);
        exercicesReussis = mock(ExerciceReussiRepository.class);
        series = mock(SerieRepository.class);
        events = mock(ApplicationEventPublisher.class);
        service = new ProgressionService(
                evenements, soldes, chapitres, sectionsLues, exercicesReussis, series,
                mock(SoumissionCompetenceRepository.class), mock(MaitriseRepository.class), events);
        // Defaults: nothing awarded yet, cap not reached, structure not known.
        when(evenements.existsByEleveIdAndSourceTypeAndSourceRef(any(), any(), any())).thenReturn(false);
        when(evenements.sommePointsDepuis(any(), any())).thenReturn(0);
    }

    private static Chapitre chapitre(String id, int ordre, int totalSections, int totalExercices) {
        Chapitre c = new Chapitre(id);
        c.maj("6e", "mathematiques", ordre, "published", totalSections, totalExercices);
        return c;
    }

    private SoumissionEnregistree soumissionReussie(UUID exo) {
        return new SoumissionEnregistree(
                eleve, exo, UUID.randomUUID(), CHAP, true, 1.0, true, List.of(), Instant.now());
    }

    // ── section read ────────────────────────────────────────────────────────

    @Test
    void relireUneSectionNeReEnregistrePasNiNeReRecompense() {
        when(sectionsLues.existsByEleveIdAndChapitreIdAndSectionId(eleve, CHAP, "intro")).thenReturn(true);
        when(evenements.existsByEleveIdAndSourceTypeAndSourceRef(eleve, "section", CHAP + "/intro"))
                .thenReturn(true);

        service.onSectionTerminee(new SectionTerminee(eleve, CHAP, "intro", Instant.now()));

        verify(sectionsLues, never()).save(any());
        verify(evenements, never()).save(any());
    }

    // ── chapter completion ────────────────────────────────────────────────────

    @Test
    void chapitreTermineDonne50EtEmetLEvenement() {
        // 2 sections read, 8/10 exercises solved (exactly the 80 % gate).
        when(chapitres.findById(CHAP)).thenReturn(Optional.of(chapitre(CHAP, 0, 2, 10)));
        when(sectionsLues.countByEleveIdAndChapitreId(eleve, CHAP)).thenReturn(2L);
        when(exercicesReussis.countByEleveIdAndChapitreId(eleve, CHAP)).thenReturn(8L);

        service.onSectionTerminee(new SectionTerminee(eleve, CHAP, "s2", Instant.now()));

        ArgumentCaptor<EvenementXp> captor = ArgumentCaptor.forClass(EvenementXp.class);
        verify(evenements, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
        assertThat(captor.getAllValues())
                .anySatisfy(e -> {
                    assertThat(e.getMotif()).isEqualTo("chapitre_termine");
                    assertThat(e.getPoints()).isEqualTo((short) 50);
                });
        verify(events).publishEvent(any(ChapitreTermine.class));
    }

    @Test
    void completionCompteMemeAuDelaDuPlafondQuotidien() {
        // Daily cap reached: the exercise XP is blocked, but the solve must still be
        // recorded and the 80 % gate must still fire the chapter award (cap-exempt).
        when(evenements.sommePointsDepuis(any(), any())).thenReturn(200);
        UUID exo = UUID.randomUUID();
        when(chapitres.findById(CHAP)).thenReturn(Optional.of(chapitre(CHAP, 0, 1, 10)));
        when(sectionsLues.countByEleveIdAndChapitreId(eleve, CHAP)).thenReturn(1L);
        when(exercicesReussis.countByEleveIdAndChapitreId(eleve, CHAP)).thenReturn(8L);

        service.attribuerPourSoumission(soumissionReussie(exo));

        verify(exercicesReussis).save(any()); // solve recorded despite the cap
        ArgumentCaptor<EvenementXp> captor = ArgumentCaptor.forClass(EvenementXp.class);
        verify(evenements).save(captor.capture());
        // Only the chapter award is written; the exercise XP was capped out.
        assertThat(captor.getValue().getMotif()).isEqualTo("chapitre_termine");
        verify(events).publishEvent(any(ChapitreTermine.class));
    }

    @Test
    void chapitreDejaTermineNeReDonnePasNiNeReEmet() {
        when(chapitres.findById(CHAP)).thenReturn(Optional.of(chapitre(CHAP, 0, 1, 0)));
        when(evenements.existsByEleveIdAndSourceTypeAndSourceRef(eleve, "chapitre", CHAP)).thenReturn(true);
        when(sectionsLues.countByEleveIdAndChapitreId(eleve, CHAP)).thenReturn(1L);

        service.onSectionTerminee(new SectionTerminee(eleve, CHAP, "s1", Instant.now()));

        verify(events, never()).publishEvent(any(ChapitreTermine.class));
    }

    @Test
    void pasDeCompletionSansTouteLesSections() {
        when(chapitres.findById(CHAP)).thenReturn(Optional.of(chapitre(CHAP, 0, 3, 10)));
        when(sectionsLues.countByEleveIdAndChapitreId(eleve, CHAP)).thenReturn(2L); // 2/3 sections
        when(exercicesReussis.countByEleveIdAndChapitreId(eleve, CHAP)).thenReturn(10L);

        service.onSectionTerminee(new SectionTerminee(eleve, CHAP, "s2", Instant.now()));

        verify(events, never()).publishEvent(any(ChapitreTermine.class));
    }

    // ── path states & locks ─────────────────────────────────────────────────

    @Test
    void parcoursMarqueUnSeulNoeudActif() {
        when(chapitres.findByNiveauCodeAndMatiereCodeAndStatutOrderByOrdreAsc("6e", "mathematiques", "published"))
                .thenReturn(List.of(
                        chapitre("c1", 0, 1, 0),
                        chapitre("c2", 1, 1, 0),
                        chapitre("c3", 2, 1, 0)));
        // c1 done, c2 and c3 untouched.
        when(evenements.existsByEleveIdAndSourceTypeAndSourceRef(eleve, "chapitre", "c1")).thenReturn(true);

        List<ParcoursChapitre> parcours = service.parcours("6e", "mathematiques", eleve);

        assertThat(parcours).extracting(ParcoursChapitre::etat).containsExactly(
                EtatParcours.FAIT, EtatParcours.EN_COURS, EtatParcours.VERROUILLE);
        assertThat(parcours).filteredOn(p -> p.etat() == EtatParcours.EN_COURS).hasSize(1);
        assertThat(parcours.get(0).pourcentage()).isEqualTo(100); // clamp on FAIT
    }

    @Test
    void chapitreToucheResteDeverrouilleMemeSiLePrecedentNestPasFait() {
        when(chapitres.findByNiveauCodeAndMatiereCodeAndStatutOrderByOrdreAsc("6e", "mathematiques", "published"))
                .thenReturn(List.of(
                        chapitre("c1", 0, 2, 0),
                        chapitre("c2", 1, 2, 0)));
        // c1 not done, c2 has been touched (1 of its 2 sections read).
        when(sectionsLues.countByEleveIdAndChapitreId(eleve, "c2")).thenReturn(1L);

        List<ParcoursChapitre> parcours = service.parcours("6e", "mathematiques", eleve);

        assertThat(parcours.get(1).etat()).isEqualTo(EtatParcours.EN_COURS); // stays unlocked
        assertThat(parcours.get(1).pourcentage()).isEqualTo(50); // 1 of 2 sections
    }

    @Test
    void pourcentageMeleSectionsEtExercices() {
        when(chapitres.findByNiveauCodeAndMatiereCodeAndStatutOrderByOrdreAsc("6e", "mathematiques", "published"))
                .thenReturn(List.of(chapitre("c1", 0, 2, 8)));
        when(sectionsLues.countByEleveIdAndChapitreId(eleve, "c1")).thenReturn(1L);
        when(exercicesReussis.countByEleveIdAndChapitreId(eleve, "c1")).thenReturn(2L);

        List<ParcoursChapitre> parcours = service.parcours("6e", "mathematiques", eleve);

        // (1 section + 2 exercices) / (2 + 8) = 30 %
        assertThat(parcours.get(0).pourcentage()).isEqualTo(30);
    }
}
