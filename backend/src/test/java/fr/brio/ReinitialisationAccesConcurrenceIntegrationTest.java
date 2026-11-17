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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
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
    @Autowired UserDetailsService userDetails;
    @Autowired AuthenticationSuccessHandler loginSuccess;

    private record Eleve(EleveInscritInfo info, String provisoire) {}

    private record Inscrit(EleveInscritInfo eleve, UUID classe, UUID prof) {}

    private Inscrit eleveInscrit() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        UUID etab = classeService.creerEtablissement(
                "Collège Course " + suffix, null, "college", LocalDate.now().minusYears(1), "CONV-" + suffix).id();
        UUID prof = compteService.creerEnseignant(
                MOT_DE_PASSE, "Prof " + suffix, "prof-" + suffix + "@example.fr", etab).id();
        UUID classe = classeService.creerClassePourEnseignant(prof, etab, "5e", "5e R").id();
        EleveInscritInfo eleve = classeService.rejoindreParCode(
                classeService.genererCodePourEnseignant(classe, prof).code(), MOT_DE_PASSE, "Inès");
        return new Inscrit(eleve, classe, prof);
    }

    private Eleve eleveReinitialise() {
        Inscrit inscrit = eleveInscrit();
        String provisoire = reinitialisations.reinitialiser(
                inscrit.classe(), inscrit.eleve().id(), inscrit.prof(), false).motDePasseProvisoire();
        return new Eleve(inscrit.eleve(), provisoire);
    }

    private MockHttpServletResponse connexion(String identifiant, String motDePasse, String ip) throws Exception {
        return mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("identifiant", identifiant)
                        .param("mot_de_passe", motDePasse)
                        .with(r -> {
                            r.setRemoteAddr(ip);
                            return r;
                        })
                        .with(csrf()))
                .andReturn().getResponse();
    }

    /** The end of a login whose password was already checked against {@code charge}. */
    private MockHttpServletResponse finirConnexion(UserDetails charge, String identifiant) throws Exception {
        var auth = UsernamePasswordAuthenticationToken.authenticated(charge, null, charge.getAuthorities());
        auth.eraseCredentials();
        var req = new MockHttpServletRequest("POST", "/api/sessions");
        req.setParameter("identifiant", identifiant);
        req.setRemoteAddr("100.127.240.10");
        var res = new MockHttpServletResponse();
        loginSuccess.onAuthenticationSuccess(req, res, auth);
        return res;
    }

    @Test
    void shouldNeverLetALoginWithTheOldPasswordUndoAResetInProgress() throws Exception {
        Inscrit inscrit = eleveInscrit();
        UUID eleveId = inscrit.eleve().id();
        String identifiant = inscrit.eleve().identifiantConnexion();
        // The login loads the account and checks the OLD password: it matches.
        UserDetails charge = userDetails.loadUserByUsername(identifiant);

        CountDownLatch resetEcrit = new CountDownLatch(1);
        CountDownLatch resetPeutValider = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            // The teacher's reset: the student's row is locked and rewritten, not yet committed.
            Future<String> reset = pool.submit(() -> transactions.execute(s -> {
                String p = reinitialisations.reinitialiser(
                        inscrit.classe(), eleveId, inscrit.prof(), false).motDePasseProvisoire();
                resetEcrit.countDown();
                try {
                    resetPeutValider.await(10, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                return p;
            }));
            assertThat(resetEcrit.await(10, TimeUnit.SECONDS)).isTrue();

            // Meanwhile the login with the old password finishes. Read without a lock, it would
            // see the account as it was and write that old state back over the reset on commit.
            Future<MockHttpServletResponse> login = pool.submit(() -> finirConnexion(charge, identifiant));
            Thread.sleep(500); // the login reaches the student's row while the reset holds it
            resetPeutValider.countDown();
            String provisoire = reset.get(10, TimeUnit.SECONDS);
            MockHttpServletResponse res = login.get(10, TimeUnit.SECONDS);

            // The login is refused exactly like a wrong password...
            assertThat(res.getStatus()).isEqualTo(401);
            assertThat(res.getContentAsString())
                    .isEqualTo("{\"error\":\"Identifiant ou mot de passe incorrect\"}");
            // ...and the reset stands: change pending, the old password no longer opens, the
            // provisional one does.
            assertThat(comptes.findById(eleveId).orElseThrow().isDoitChangerMotDePasse()).isTrue();
            assertThat(connexion(identifiant, MOT_DE_PASSE, "100.127.241.10").getStatus()).isEqualTo(401);
            assertThat(connexion(identifiant, provisoire, "100.127.242.10").getStatus()).isEqualTo(200);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void shouldConsumeTheProvisionalPasswordOnlyOnceAtTheDatabase() {
        Eleve eleve = eleveReinitialise();
        Instant maintenant = Instant.now();
        Instant reinitialiseLe = comptes.findById(eleve.info().id()).orElseThrow().getAccesReinitialiseLe();

        Integer premier = transactions.execute(
                s -> comptes.consommerMotDePasseProvisoire(eleve.info().id(), reinitialiseLe, maintenant));
        Integer second = transactions.execute(
                s -> comptes.consommerMotDePasseProvisoire(eleve.info().id(), reinitialiseLe, maintenant));

        assertThat(premier).isEqualTo(1);
        assertThat(second).isZero();
    }

    @Test
    void shouldNotConsumeAProvisionalPasswordIssuedAfterTheAccountWasLoaded() {
        Eleve eleve = eleveReinitialise();
        Instant avant = comptes.findById(eleve.info().id()).orElseThrow().getAccesReinitialiseLe();

        // An older reset state (or none at all): never the provisional password pending now.
        Integer ancien = transactions.execute(s -> comptes.consommerMotDePasseProvisoire(
                eleve.info().id(), avant.minusSeconds(1), Instant.now()));
        Integer aucun = transactions.execute(s -> comptes.consommerMotDePasseProvisoire(
                eleve.info().id(), null, Instant.now()));

        assertThat(ancien).isZero();
        assertThat(aucun).isZero();
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
