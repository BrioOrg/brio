package fr.brio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.domain.Etablissement;
import fr.brio.identite.infrastructure.CompteRepository;
import fr.brio.identite.infrastructure.EtablissementRepository;
import fr.brio.progression.ProgressionService;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.context.WebApplicationContext;

/**
 * Console de modération de la Communauté de bout en bout (porte 5/6 de #357, suivi #338) : rôle
 * {@code admin_brio}, invisibilité d'un contenu modéré, signalement en rafale ou doublé, révocation
 * de l'XP par le listener de {@code progression}, contestation et décisions concurrentes.
 */
@SpringBootTest(properties = "brio.communaute.active=true")
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class ModerationCommunauteIntegrationTest {

    private static final String CORPS = "[{\"id\":\"p\",\"type\":\"prose\",\"text\":\"Comment faire ?\"}]";
    private static final String QUESTION = "{\"titre\":\"Une question\",\"corps\":" + CORPS + "}";
    private static final String REPONSE = "{\"corps\":" + CORPS + "}";
    private static final String ADMIN_SIGNALEMENTS = "/api/admin/communaute/signalements";

    @Autowired WebApplicationContext context;
    @Autowired CompteRepository comptes;
    @Autowired EtablissementRepository etablissements;
    @Autowired ProgressionService progression;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;

    MockMvc mockMvc;
    Compte auteur;
    Compte repondeur;
    Compte tiers;
    Compte prof;
    UUID admin;

    @BeforeEach
    void setup() {
        mockMvc = webAppContextSetup(context).apply(springSecurity()).build();
        // La file est globale : on repart d'une file vide pour lire ce que chaque test y met.
        jdbc.update("UPDATE social.communaute_signalements SET statut = 'traite' WHERE statut = 'ouvert'");
        jdbc.update("UPDATE social.communaute_contestations SET statut = 'rejetee' WHERE statut = 'ouverte'");
        String unique = UUID.randomUUID().toString();
        String uai = String.format("%07dC", Math.abs(unique.hashCode()) % 10_000_000);
        UUID etablissementId = etablissements.save(Etablissement.creer(
                "Collège " + unique, uai, "college", LocalDate.now(), "CONV-" + unique)).getId();
        prof = comptes.save(Compte.creerEnseignant(
                "prof." + unique, "{noop}mdp", "Mme Durand", unique + "@brio.test"));
        auteur = comptes.save(Compte.creerEleveMissionEtablissement(
                "auteur." + unique, "{noop}mdp", etablissementId, "Renard-" + unique));
        repondeur = comptes.save(Compte.creerEleveMissionEtablissement(
                "repondeur." + unique, "{noop}mdp", etablissementId, "Loutre-" + unique));
        tiers = comptes.save(Compte.creerEleveMissionEtablissement(
                "tiers." + unique, "{noop}mdp", etablissementId, "Lynx-" + unique));
        admin = comptes.save(Compte.creerAdminBrio(
                "admin." + unique, "{noop}mdp", "Équipe brio", "admin." + unique + "@brio.test")).getId();
    }

    // ---- rôle ---------------------------------------------------------------------

    @Test
    void shouldKeepTheModerationConsoleForAdminBrioOnly() throws Exception {
        UUID question = poser(auteur);
        String decision = "/api/admin/communaute/question/" + question + "/decision";
        String trancher = "/api/admin/communaute/contestations/" + UUID.randomUUID();
        String masquer = "{\"action\":\"masquer\"}";
        String accepter = "{\"accepter\":true}";

        for (Compte qui : List.of(auteur, prof)) {
            mockMvc.perform(get(ADMIN_SIGNALEMENTS).with(comme(qui))).andExpect(status().isForbidden());
            ecrire(post(decision), masquer, comme(qui)).andExpect(status().isForbidden());
            ecrire(post(trancher), accepter, comme(qui)).andExpect(status().isForbidden());
        }
        mockMvc.perform(get(ADMIN_SIGNALEMENTS)).andExpect(status().isUnauthorized());
        mockMvc.perform(get(ADMIN_SIGNALEMENTS).with(enAdmin())).andExpect(status().isOk());
        lire(question, tiers).andExpect(status().isOk()); // rien n'a été masqué
    }

    @Test
    void shouldAnswer422OnAnEmptyDecisionOrVerdict() throws Exception {
        UUID question = poser(auteur);
        ecrire(post("/api/admin/communaute/question/" + question + "/decision"), "{}", enAdmin())
                .andExpect(status().is4xxClientError());
        ecrire(post("/api/admin/communaute/contestations/" + UUID.randomUUID()), "{}", enAdmin())
                .andExpect(status().is4xxClientError());
    }

    // ---- élève : signaler ----------------------------------------------------------

    @Test
    void shouldHideAMaskedQuestionFromEveryStudentAndCloseItsReports() throws Exception {
        UUID question = poser(auteur);
        signaler("questions", question, tiers).andExpect(status().isNoContent());
        assertThat(entreeDeFile(question)).isNotNull();

        decider("question", question, "masquer").andExpect(status().isCreated());

        lire(question, tiers).andExpect(status().isNotFound());
        assertThat(idsListes()).doesNotContain(question.toString());
        assertThat(entreeDeFile(question)).isNull();
    }

    @Test
    void shouldHideAMaskedAnswerAndItsCommentsFromTheThread() throws Exception {
        UUID question = poser(auteur);
        UUID reponse = repondre(question, repondeur);
        UUID commentaire = commenter(reponse, tiers);

        decider("reponse", reponse, "masquer").andExpect(status().isCreated());

        String fil = texte(lire(question, tiers).andExpect(status().isOk()));
        assertThat(fil).doesNotContain(reponse.toString()).doesNotContain(commentaire.toString());
        // et on ne signale pas ce qu'on ne peut plus lire
        signaler("reponses", commentaire, auteur).andExpect(status().isNotFound());
    }

    @Test
    void shouldRefuseToReportOnesOwnMessage() throws Exception {
        UUID question = poser(auteur);

        signaler("questions", question, auteur).andExpect(status().isForbidden());

        assertThat(entreeDeFile(question)).isNull();
    }

    @Test
    void shouldCountADoubleClickedReportOnce() throws Exception {
        UUID question = poser(auteur);

        List<Integer> statuts = enParallele(2, () -> statut(signaler("questions", question, tiers)));

        assertThat(statuts).allMatch(s -> s == 204 || s == 409);
        assertThat(statuts).contains(204);
        signaler("questions", question, tiers).andExpect(status().isNoContent());
        assertThat(entreeDeFile(question).get("nombreSignalements").asInt()).isEqualTo(1);
    }

    @Test
    void shouldThrottleReportsInABurst() throws Exception {
        List<UUID> cibles = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            cibles.add(poser(auteur));
        }
        UUID question = cibles.get(0);
        for (int i = 0; i < 3; i++) {
            cibles.add(repondre(question, repondeur));
        }

        for (int i = 0; i < 5; i++) {
            String type = i < 3 ? "questions" : "reponses";
            signaler(type, cibles.get(i), tiers).andExpect(status().isNoContent());
        }
        signaler("reponses", cibles.get(5), tiers).andExpect(status().isTooManyRequests());
    }

    @Test
    void shouldLetAVictimReportAgainWhenTheAuthorRewritesAfterARejection() throws Exception {
        UUID question = poser(auteur);
        UUID reponse = repondre(question, repondeur);
        modifier(reponse, "Texte blessant").andExpect(status().isNoContent());
        signaler("reponses", reponse, tiers).andExpect(status().isNoContent());
        // l'auteur adoucit, l'admin rejette sur la version adoucie…
        modifier(reponse, "Texte anodin").andExpect(status().isNoContent());
        JsonNode entree = entreeDeFile(reponse);
        assertThat(entree.get("extraitAuSignalement").asText()).contains("blessant");
        assertThat(entree.get("extrait").asText()).contains("anodin");
        decider("reponse", reponse, "rejeter").andExpect(status().isCreated());
        assertThat(entreeDeFile(reponse)).isNull();

        // …puis remet son texte : la victime peut le signaler de nouveau.
        modifier(reponse, "Texte blessant").andExpect(status().isNoContent());
        signaler("reponses", reponse, tiers).andExpect(status().isNoContent());

        assertThat(entreeDeFile(reponse).get("nombreSignalements").asInt()).isEqualTo(1);
    }

    // ---- admin : décisions ----------------------------------------------------------

    @Test
    void shouldRevokeTheUsefulAnswerXpAndKeepTheContentInTheQueue() throws Exception {
        UUID question = poser(auteur);
        UUID reponse = repondre(question, repondeur);
        ecrire(post("/api/communaute/questions/" + question + "/reponses/" + reponse + "/resolution"), null,
                        comme(auteur))
                .andExpect(status().isNoContent());
        await().atMost(Duration.ofSeconds(10)).until(() -> progression.pour(repondeur.getId()).xpTotal() == 15);
        signaler("reponses", reponse, tiers).andExpect(status().isNoContent());

        decider("reponse", reponse, "revoquer_xp").andExpect(status().isCreated());

        await().atMost(Duration.ofSeconds(10)).until(() -> progression.pour(repondeur.getId()).xpTotal() == 0);
        JsonNode entree = entreeDeFile(reponse);
        assertThat(entree).isNotNull(); // révoquer l'XP ne juge pas la visibilité
        assertThat(entree.get("xpDejaRevoquee").asBoolean()).isTrue();
        decider("reponse", reponse, "revoquer_xp").andExpect(status().isUnprocessableEntity());
        decider("reponse", reponse, "masquer").andExpect(status().isCreated());
        assertThat(entreeDeFile(reponse)).isNull();
    }

    @Test
    void shouldNeverRepublishAContentItsAuthorDeleted() throws Exception {
        UUID question = poser(auteur);
        signaler("questions", question, tiers).andExpect(status().isNoContent());
        ecrire(delete("/api/communaute/questions/" + question), null, comme(auteur))
                .andExpect(status().isNoContent());

        decider("question", question, "restaurer").andExpect(status().isUnprocessableEntity());
        decider("question", question, "masquer").andExpect(status().isUnprocessableEntity());

        lire(question, tiers).andExpect(status().isNotFound());
    }

    // ---- contestation -----------------------------------------------------------------

    @Test
    void shouldLetTheAuthorContestOnceAndRestoreWhenAccepted() throws Exception {
        UUID question = poser(auteur);
        contester("questions", question, auteur).andExpect(status().isUnprocessableEntity()); // rien à contester
        decider("question", question, "masquer").andExpect(status().isCreated());

        contester("questions", question, tiers).andExpect(status().isForbidden());
        contester("questions", question, auteur).andExpect(status().isCreated());
        contester("questions", question, auteur).andExpect(status().isUnprocessableEntity());

        UUID contestation = contestationOuverte(question);
        ecrire(post("/api/admin/communaute/contestations/" + contestation),
                        "{\"accepter\":true,\"reponse\":\"Tu as raison.\"}", enAdmin())
                .andExpect(status().isNoContent());

        lire(question, tiers).andExpect(status().isOk());
        assertThat(contestationOuverte(question)).isNull();
    }

    @Test
    void shouldLetOnlyOneOfTwoAdminsDecideTheSameContestation() throws Exception {
        UUID question = poser(auteur);
        decider("question", question, "masquer").andExpect(status().isCreated());
        contester("questions", question, auteur).andExpect(status().isCreated());
        UUID contestation = contestationOuverte(question);
        String url = "/api/admin/communaute/contestations/" + contestation;

        List<Integer> statuts = enParallele(2, () -> statut(ecrire(post(url), "{\"accepter\":true}", enAdmin())));
        assertThat(statuts).containsOnlyOnce(204);
        assertThat(statuts).allMatch(s -> s == 204 || s == 409 || s == 422);
        Integer decisions = jdbc.queryForObject(
                "SELECT count(*) FROM social.communaute_decisions WHERE cible_id = ? AND action = 'restaurer'",
                Integer.class, question);
        assertThat(decisions).isEqualTo(1);
    }

    // ---- outils -------------------------------------------------------------------------

    private UUID poser(Compte qui) throws Exception {
        return id(ecrire(post("/api/communaute/questions"), QUESTION, comme(qui)).andExpect(status().isCreated()));
    }

    private UUID repondre(UUID question, Compte qui) throws Exception {
        return id(ecrire(post("/api/communaute/questions/" + question + "/reponses"), REPONSE, comme(qui))
                .andExpect(status().isCreated()));
    }

    private UUID commenter(UUID reponse, Compte qui) throws Exception {
        return id(ecrire(post("/api/communaute/reponses/" + reponse + "/commentaires"), REPONSE, comme(qui))
                .andExpect(status().isCreated()));
    }

    private ResultActions modifier(UUID reponse, String texte) throws Exception {
        String corps = "{\"corps\":[{\"id\":\"p\",\"type\":\"prose\",\"text\":\"" + texte + "\"}]}";
        return ecrire(put("/api/communaute/reponses/" + reponse), corps, comme(repondeur));
    }

    private ResultActions signaler(String type, UUID id, Compte qui) throws Exception {
        return ecrire(post("/api/communaute/" + type + "/" + id + "/signalement"), "{\"motif\":\"pas gentil\"}",
                comme(qui));
    }

    private ResultActions contester(String type, UUID id, Compte qui) throws Exception {
        return ecrire(post("/api/communaute/" + type + "/" + id + "/contestation"),
                "{\"message\":\"Je ne comprends pas.\"}", comme(qui));
    }

    private ResultActions decider(String type, UUID id, String action) throws Exception {
        return ecrire(post("/api/admin/communaute/" + type + "/" + id + "/decision"),
                "{\"action\":\"" + action + "\"}", enAdmin());
    }

    private ResultActions lire(UUID question, Compte qui) throws Exception {
        return mockMvc.perform(get("/api/communaute/questions/" + question).with(comme(qui)));
    }

    private List<String> idsListes() throws Exception {
        List<String> ids = new ArrayList<>();
        json.readTree(texte(mockMvc.perform(get("/api/communaute/questions?taille=50").with(comme(tiers)))))
                .path("questions").forEach(q -> ids.add(q.get("id").asText()));
        return ids;
    }

    /** L'entrée de la file d'admin pour cette cible, ou null si elle n'y est pas. */
    private JsonNode entreeDeFile(UUID cible) throws Exception {
        for (JsonNode e : json.readTree(texte(mockMvc.perform(get(ADMIN_SIGNALEMENTS).with(enAdmin()))))) {
            if (e.get("cibleId").asText().equals(cible.toString())) {
                return e;
            }
        }
        return null;
    }

    private UUID contestationOuverte(UUID cible) throws Exception {
        for (JsonNode c : json.readTree(texte(mockMvc.perform(
                get("/api/admin/communaute/contestations").with(enAdmin()))))) {
            if (c.get("cibleId").asText().equals(cible.toString())) {
                return UUID.fromString(c.get("id").asText());
            }
        }
        return null;
    }

    private ResultActions ecrire(MockHttpServletRequestBuilder requete, String contenu, RequestPostProcessor qui)
            throws Exception {
        if (contenu != null) {
            requete = requete.contentType("application/json").content(contenu);
        }
        return mockMvc.perform(requete.with(qui).with(csrf()));
    }

    private static <T> List<T> enParallele(int n, Callable<T> tache) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(n);
        try {
            CountDownLatch depart = new CountDownLatch(1);
            List<Future<T>> futurs = new ArrayList<>();
            for (int i = 0; i < n; i++) {
                futurs.add(pool.submit(() -> {
                    depart.await();
                    return tache.call();
                }));
            }
            depart.countDown();
            List<T> resultats = new ArrayList<>();
            for (Future<T> f : futurs) {
                resultats.add(f.get());
            }
            return resultats;
        } finally {
            pool.shutdownNow();
        }
    }

    private static int statut(ResultActions resultat) {
        return resultat.andReturn().getResponse().getStatus();
    }

    private UUID id(ResultActions resultat) throws Exception {
        return UUID.fromString(json.readTree(texte(resultat)).get("id").asText());
    }

    private static String texte(ResultActions resultat) throws Exception {
        return resultat.andReturn().getResponse().getContentAsString();
    }

    private RequestPostProcessor enAdmin() {
        return user(admin.toString()).roles("ADMIN_BRIO");
    }

    private static RequestPostProcessor comme(Compte qui) {
        String role = qui.getRole().name().equals("eleve") ? "ELEVE" : "ENSEIGNANT";
        return user(qui.getId().toString()).roles(role);
    }
}
