package fr.brio.identite.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import fr.brio.identite.domain.Compte;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class EnseignantContexteQueryImplTest {

    @Mock ClasseRepository classes;
    @Mock CompteRepository comptes;
    @Mock RattachementRepository rattachements;
    @InjectMocks EnseignantContexteQueryImpl query;

    @Test
    void returnsTeacherNamesButNeverAStudentsName() {
        Compte prof = avecId(Compte.creerEnseignant("prof.x", "h", "Mme Durand", "p@x.fr"));
        Compte eleve = avecId(Compte.creerEleveMissionEtablissement("eleve.x", "h", UUID.randomUUID()));
        when(comptes.findAllById(Set.of(prof.getId(), eleve.getId()))).thenReturn(List.of(prof, eleve));

        assertThat(query.nomsDesEnseignants(Set.of(prof.getId(), eleve.getId())))
                .containsExactlyEntriesOf(Map.of(prof.getId(), "Mme Durand"));
    }

    @Test
    void skipsTheLookupForNoIds() {
        assertThat(query.nomsDesEnseignants(Set.of())).isEmpty();
        verifyNoInteractions(comptes);
    }

    private static Compte avecId(Compte c) {
        ReflectionTestUtils.setField(c, "id", UUID.randomUUID());
        return c;
    }
}
