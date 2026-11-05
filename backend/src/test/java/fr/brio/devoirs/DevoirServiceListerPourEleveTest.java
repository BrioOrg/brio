package fr.brio.devoirs;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import fr.brio.devoirs.domain.Devoir;
import fr.brio.devoirs.domain.Rendu;
import fr.brio.devoirs.infrastructure.DevoirRepository;
import fr.brio.devoirs.infrastructure.RenduExerciceRepository;
import fr.brio.devoirs.infrastructure.RenduPieceRepository;
import fr.brio.devoirs.infrastructure.RenduRepository;
import fr.brio.devoirs.infrastructure.StockageCopies;
import fr.brio.identite.api.EnseignantContexteQuery;
import fr.brio.identite.api.InscriptionsQuery;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DevoirServiceListerPourEleveTest {

    private final DevoirRepository devoirs = mock(DevoirRepository.class);
    private final RenduRepository rendus = mock(RenduRepository.class);
    private final EnseignantContexteQuery enseignants = mock(EnseignantContexteQuery.class);
    private final InscriptionsQuery inscriptions = mock(InscriptionsQuery.class);
    private final DevoirService service =
            new DevoirService(
                    devoirs,
                    rendus,
                    mock(RenduExerciceRepository.class),
                    enseignants,
                    inscriptions,
                    mock(RenduPieceRepository.class),
                    mock(StockageCopies.class));

    private final UUID eleve = UUID.randomUUID();
    private final UUID classe = UUID.randomUUID();
    private final UUID prof = UUID.randomUUID();

    private Devoir devoirSurChapitre() {
        Instant maintenant = Instant.parse("2026-10-01T08:00:00Z");
        Devoir devoir =
                new Devoir(
                        classe, prof, "DM", null, null, "chapitre", "fractions", null,
                        List.of(UUID.randomUUID()), maintenant, maintenant.plusSeconds(3600));
        when(inscriptions.classesDeLEleve(eleve)).thenReturn(Set.of(classe));
        when(devoirs.findByClasseIdInAndStatut(Set.of(classe), "publie")).thenReturn(List.of(devoir));
        return devoir;
    }

    @Test
    void shouldExposeTheClassTheSourceAndTheTeacherName() {
        devoirSurChapitre();
        when(enseignants.nomsDesEnseignants(Set.of(prof))).thenReturn(Map.of(prof, "M. Dubois"));

        DevoirEleveVue vue = service.listerPourEleve(eleve).get(0);

        assertThat(vue.classeId()).isEqualTo(classe);
        assertThat(vue.enseignant()).isEqualTo("M. Dubois");
        assertThat(vue.sourceType()).isEqualTo("chapitre");
        assertThat(vue.sourceRef()).isEqualTo("fractions");
        assertThat(vue.statutRendu()).isEqualTo("non_commence");
        assertThat(vue.corrige()).isFalse();
    }

    @Test
    void shouldMarkACorrectedRendu() {
        Devoir devoir = devoirSurChapitre();
        Rendu rendu = new Rendu(devoir.getId(), eleve);
        rendu.corriger(BigDecimal.TEN, "Bien", prof);
        when(rendus.findByEleveIdAndDevoirIdIn(any(), any())).thenReturn(List.of(rendu));
        when(enseignants.nomsDesEnseignants(any())).thenReturn(Map.of());

        DevoirEleveVue vue = service.listerPourEleve(eleve).get(0);

        assertThat(vue.corrige()).isTrue();
        assertThat(vue.enseignant()).isNull();
    }
}
