package fr.brio.identite.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

import fr.brio.identite.ClasseService;
import fr.brio.identite.api.EtablissementInfo;
import fr.brio.identite.domain.BaseLegale;
import fr.brio.identite.domain.Classe;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.domain.Inscription;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * The local seeder must give prof.demo's class a student who can actually read a course
 * published to it (#153), created the way the real class-code flow does, and stay
 * idempotent across restarts. Repositories are in-memory fakes: ids are JPA-generated in
 * production, so the fake assigns them on save.
 */
class LocalAccountSeederTest {

    private final List<Compte> comptesStore = new ArrayList<>();
    private final List<Classe> classesStore = new ArrayList<>();
    private final List<Inscription> inscriptionsStore = new ArrayList<>();
    private final UUID etablissementId = UUID.randomUUID();

    private LocalAccountSeeder seeder;

    @BeforeEach
    void setUp() {
        CompteRepository comptes = mock(CompteRepository.class);
        lenient().when(comptes.findByIdentifiantConnexion(anyString())).thenAnswer(inv ->
                comptesStore.stream()
                        .filter(c -> c.getIdentifiantConnexion().equals(inv.getArgument(0)))
                        .findFirst());
        lenient().when(comptes.save(any(Compte.class))).thenAnswer(inv -> {
            Compte c = inv.getArgument(0);
            ReflectionTestUtils.setField(c, "id", UUID.randomUUID());
            comptesStore.add(c);
            return c;
        });

        ClasseRepository classes = mock(ClasseRepository.class);
        lenient().when(classes.findByEnseignantPrincipalId(any())).thenAnswer(inv ->
                classesStore.stream()
                        .filter(c -> inv.getArgument(0).equals(c.getEnseignantPrincipalId()))
                        .toList());

        InscriptionRepository inscriptions = mock(InscriptionRepository.class);
        lenient().when(inscriptions.save(any(Inscription.class))).thenAnswer(inv -> {
            inscriptionsStore.add(inv.getArgument(0));
            return inv.getArgument(0);
        });

        ClasseService classeService = mock(ClasseService.class);
        lenient().when(classeService.creerEtablissement(anyString(), isNull(), anyString(), any(), anyString()))
                .thenReturn(new EtablissementInfo(
                        etablissementId, "Collège Démo", null, "college", null, "CONV-DEMO", true));
        lenient().when(classeService.creerClasse(eq(etablissementId), anyString(), anyString(), anyString(), any()))
                .thenAnswer(inv -> {
                    Classe c = Classe.creer(etablissementId, inv.getArgument(1), inv.getArgument(2),
                            inv.getArgument(3), inv.getArgument(4));
                    ReflectionTestUtils.setField(c, "id", UUID.randomUUID());
                    classesStore.add(c);
                    return null; // the seeder ignores it
                });

        PasswordEncoder encoder = mock(PasswordEncoder.class);
        lenient().when(encoder.encode(anyString())).thenReturn("{noop}hash");

        seeder = new LocalAccountSeeder(comptes, classes, inscriptions, classeService, encoder);
    }

    @Test
    void shouldEnrolAPathAStudentInProfDemosClass() {
        seeder.run(null);

        Compte eleve = compte("eleve.classe").orElseThrow();
        assertThat(eleve.getBaseLegale()).isEqualTo(BaseLegale.mission_etablissement);
        // Path A: attached to the class's établissement, as rejoindreParCode does (no getter).
        assertThat(ReflectionTestUtils.getField(eleve, "etablissementId")).isEqualTo(etablissementId);

        Classe classeDemo = classesStore.getFirst();
        assertThat(inscriptionsStore).singleElement().satisfies(i -> {
            assertThat(i.getId().classeId()).isEqualTo(classeDemo.getId());
            assertThat(i.getId().compteId()).isEqualTo(eleve.getId());
        });
    }

    @Test
    void shouldNotDuplicateAccountsOrInscriptionsOnRestart() {
        seeder.run(null);
        seeder.run(null);

        assertThat(comptesStore).extracting(Compte::getIdentifiantConnexion)
                .containsExactlyInAnyOrder("prof.demo", "admin.demo", "eleve.demo", "eleve.classe");
        assertThat(classesStore).hasSize(1);
        assertThat(inscriptionsStore).hasSize(1);
    }

    private Optional<Compte> compte(String identifiant) {
        return comptesStore.stream()
                .filter(c -> c.getIdentifiantConnexion().equals(identifiant))
                .findFirst();
    }
}
