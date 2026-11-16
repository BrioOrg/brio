package fr.brio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import fr.brio.identite.ClasseService;
import fr.brio.identite.CompteService;
import fr.brio.identite.ReinitialisationAccesService;
import fr.brio.identite.api.EleveInscritInfo;
import fr.brio.identite.infrastructure.CompteRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The provisional password is single-use even when two logins race with it (ADR 0036 §3): the
 * use is recorded by one conditional UPDATE, so exactly one of them opens a session. Not
 * {@code @Transactional}: each login must commit for the race to be real.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ReinitialisationAccesConcurrenceIntegrationTest {

    private static final String MOT_DE_PASSE = "motdepasse123";

    @Autowired MockMvc mockMvc;
    @Autowired ClasseService classeService;
    @Autowired CompteService compteService;
    @Autowired ReinitialisationAccesService reinitialisations;
    @Autowired CompteRepository comptes;
    @Autowired TransactionTemplate transactions;

    private record Eleve(EleveInscritInfo info, String provisoire) {}

    private Eleve eleveReinitialise() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        UUID etab = classeService.creerEtablissement(
                "Collège Course " + suffix, null, "college", LocalDate.now().minusYears(1), "CONV-" + suffix).id();
        UUID prof = compteService.creerEnseignant(
                MOT_DE_PASSE, "Prof " + suffix, "prof-" + suffix + "@example.fr", etab).id();
        UUID classe = classeService.creerClassePourEnseignant(prof, etab, "5e", "5e R").id();
        EleveInscritInfo eleve = classeService.rejoindreParCode(
                classeService.genererCodePourEnseignant(classe, prof).code(), MOT_DE_PASSE, "Inès");
        String provisoire = reinitialisations.reinitialiser(classe, eleve.id(), prof, false).motDePasseProvisoire();
        return new Eleve(eleve, provisoire);
    }

    @Test
    void shouldConsumeTheProvisionalPasswordOnlyOnceAtTheDatabase() {
        Eleve eleve = eleveReinitialise();
        Instant maintenant = Instant.now();

        Integer premier = transactions.execute(s -> comptes.consommerMotDePasseProvisoire(eleve.info().id(), maintenant));
        Integer second = transactions.execute(s -> comptes.consommerMotDePasseProvisoire(eleve.info().id(), maintenant));

        assertThat(premier).isEqualTo(1);
        assertThat(second).isZero();
    }

    @Test
    void shouldOpenOnlyOneSessionWhenLoginsRaceWithTheProvisionalPassword() throws Exception {
        Eleve eleve = eleveReinitialise();
        int nb = 4;
        CyclicBarrier depart = new CyclicBarrier(nb);
        ExecutorService pool = Executors.newFixedThreadPool(nb);
        try {
            List<Future<MockHttpServletResponse>> futures = new ArrayList<>();
            for (int i = 0; i < nb; i++) {
                String ip = "100.127." + (200 + i) + ".10"; // distinct /24: no per-IP throttling
                futures.add(pool.submit(() -> {
                    depart.await();
                    return mockMvc.perform(post("/api/sessions")
                                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                    .param("identifiant", eleve.info().identifiantConnexion())
                                    .param("mot_de_passe", eleve.provisoire())
                                    .with(r -> {
                                        r.setRemoteAddr(ip);
                                        return r;
                                    })
                                    .with(csrf()))
                            .andReturn().getResponse();
                }));
            }
            List<MockHttpServletResponse> reponses = new ArrayList<>();
            for (var f : futures) {
                reponses.add(f.get());
            }

            assertThat(reponses).filteredOn(r -> r.getStatus() == 200).hasSize(1);
            // Every loser is answered exactly like a wrong password: nothing to tell them apart.
            assertThat(reponses).filteredOn(r -> r.getStatus() != 200)
                    .allSatisfy(r -> {
                        assertThat(r.getStatus()).isEqualTo(401);
                        assertThat(r.getContentAsString())
                                .isEqualTo("{\"error\":\"Identifiant ou mot de passe incorrect\"}");
                    });
        } finally {
            pool.shutdownNow();
        }
    }
}
