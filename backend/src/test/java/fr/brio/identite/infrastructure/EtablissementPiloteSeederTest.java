package fr.brio.identite.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import fr.brio.identite.domain.Etablissement;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EtablissementPiloteSeederTest {

    @Mock EtablissementRepository etablissements;

    @Test
    void shouldCreateNothingWhenNoNameIsSet() {
        new EtablissementPiloteSeeder(etablissements, "", "college").run(null);
        new EtablissementPiloteSeeder(etablissements, "  ", "college").run(null);

        verifyNoInteractions(etablissements);
    }

    @Test
    void shouldCreateTheFictionalEtablissementWithAConventionThatOpensPathA() {
        when(etablissements.existsByConventionReference("PILOTE-FICTIF")).thenReturn(false);

        new EtablissementPiloteSeeder(etablissements, "Collège pilote", "college").run(null);

        ArgumentCaptor<Etablissement> cree = ArgumentCaptor.forClass(Etablissement.class);
        verify(etablissements).save(cree.capture());
        assertThat(cree.getValue().getNom()).isEqualTo("Collège pilote");
        assertThat(cree.getValue().getConventionReference()).isEqualTo("PILOTE-FICTIF");
        assertThat(cree.getValue().peutUtiliserPathA()).isTrue();
    }

    @Test
    void shouldNotCreateItTwice() {
        when(etablissements.existsByConventionReference("PILOTE-FICTIF")).thenReturn(true);

        new EtablissementPiloteSeeder(etablissements, "Collège pilote", "college").run(null);

        verify(etablissements, never()).save(any());
    }
}
