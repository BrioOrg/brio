package fr.brio.identite.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import fr.brio.identite.domain.Inscription;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class InscriptionsQueryImplTest {

    @Mock InscriptionRepository inscriptions;
    @InjectMocks InscriptionsQueryImpl query;

    @Test
    void returnsOnlyClassesWhereAccountIsAStudent() {
        UUID compte = UUID.randomUUID();
        UUID classeEleve = UUID.randomUUID();
        UUID classeEnseignant = UUID.randomUUID();
        when(inscriptions.findByIdCompteId(compte)).thenReturn(List.of(
                Inscription.creer(classeEleve, compte, "Alice"),
                enseignantDans(classeEnseignant, compte)));

        assertThat(query.classesDeLEleve(compte)).containsExactly(classeEleve);
    }

    @Test
    void returnsEmptyWhenAccountIsInNoClass() {
        UUID compte = UUID.randomUUID();
        when(inscriptions.findByIdCompteId(compte)).thenReturn(List.of());

        assertThat(query.classesDeLEleve(compte)).isEmpty();
    }

    // Inscription defaults role to "eleve"; a teacher membership is set via reflection here so the
    // test stays a pure unit test (no persistence path that would set the column).
    private static Inscription enseignantDans(UUID classeId, UUID compteId) {
        Inscription i = Inscription.creer(classeId, compteId, "M. Prof");
        try {
            var field = Inscription.class.getDeclaredField("roleDansClasse");
            field.setAccessible(true);
            field.set(i, "enseignant");
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
        return i;
    }
}
