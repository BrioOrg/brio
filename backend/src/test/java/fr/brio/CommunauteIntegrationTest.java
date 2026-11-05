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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.identite.domain.Classe;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.domain.Etablissement;
import fr.brio.identite.domain.Inscription;
import fr.brio.identite.infrastructure.ClasseRepository;
import fr.brio.identite.infrastructure.CompteRepository;
import fr.brio.identite.infrastructure.EtablissementRepository;
import fr.brio.identite.infrastructure.InscriptionRepository;
import fr.brio.progression.ProgressionService;
import fr.brio.social.api.ReponseUtileValidee;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest(properties = "brio.communaute.active=true")
@Import(TestcontainersConfiguration.class)
@RecordApplicationEvents
class CommunauteIntegrationTest {

    private static final String NOM_AFFICHE = "Camille D.";
    private static final String NOM_AFFICHE_REPONDEUR = "Sacha M.";
    private static final String CORPS = "[{\"id\":\"p\",\"type\":\"prose\",\"text\":\"Comment faire ?\"}]";
    private static final String QUESTION = "{\"titre\":\"Une question\",\"corps\":" + CORPS + "}";
    private static final String REPONSE = "{\"corps\":" + CORPS + "}";

    @Autowired WebApplicationContext context;
    @Autowired CompteRepository comptes;
    @Autowired EtablissementRepository etablissements;
    @Autowired ClasseRepository classes;
    @Autowired InscriptionRepository inscriptions;
    @Autowired ProgressionService progression;
    @Autowired ObjectMapper json;
    @Autowired ApplicationEvents evenements;

    MockMvc mockMvc;
    Compte auteur;
    Compte repondeur;
    Compte tiers;
    Compte prof;

    @BeforeEach
    void setup() {
        mockMvc = webAppContextSetup(context).apply(springSecurity()).build();
        String unique = UUID.randomUUID().toString();
        String uai = String.format("%07dB", Math.abs(unique.hashCode()) % 10_000_000);
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
        UUID classeId = classes.save(Classe.creer(
                etablissementId, "3e", "3e A", "2026-2027", prof.getId())).getId();
        inscriptions.save(Inscription.creer(classeId, auteur.getId(), NOM_AFFICHE));
        inscriptions.save(Inscription.creer(classeId, repondeur.getId(), NOM_AFFICHE_REPONDEUR));
    }

    // ---- accès ----------------------------------------------------------------

    @Test
    void shouldRefuseATeacherOnReadsAndWrites() throws Exception {
        UUID question = poser(auteur);

        mockMvc.perform(get("/api/communaute/questions").with(comme(prof))).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/communaute/questions/" + question).with(comme(prof)))
                .andExpect(status().isForbidden());
        ecrire(post("/api/communaute/questions"), QUESTION, prof).andExpect(status().isForbidden());
        ecrire(post("/api/communaute/questions/" + question + "/reponses"), REPONSE, prof)
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldRefuseAnAnonymousCaller() throws Exception {
        mockMvc.perform(get("/api/communaute/questions")).andExpect(status().isUnauthorized());
    }

    @Test
    void shouldTellTheWebServerItIsOn() throws Exception {
        mockMvc.perform(get("/api/reglages/communaute"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void shouldLetAStudentWithoutAClassTakePart() throws Exception {
        Compte seul = Compte.creerEleve("seul." + UUID.randomUUID(), "{noop}mdp", "p@test.fr", "5e",
                "Ours-" + UUID.randomUUID());
        seul.activer();
        comptes.save(seul);

        UUID question = poser(seul);

        lire(question, seul)
                .andExpect(jsonPath("$.auteur.pseudonyme").value(seul.getPseudonyme()))
                .andExpect(jsonPath("$.auteur.niveau").value("5e"))
                .andExpect(jsonPath("$.niveau").value("5e"));
    }

    // ---- modifier et supprimer --------------------------------------------------

    @Test
    void shouldNotLetAStudentEditOrDeleteAnotherStudentsMessages() throws Exception {
        UUID question = poser(auteur);
        UUID reponse = repondre(question, repondeur);
        UUID commentaire = commenter(reponse, repondeur);

        ecrire(put("/api/communaute/questions/" + question), QUESTION, tiers).andExpect(status().isForbidden());
        ecrire(put("/api/communaute/reponses/" + reponse), REPONSE, tiers).andExpect(status().isForbidden());
        ecrire(put("/api/communaute/reponses/" + commentaire), REPONSE, tiers).andExpect(status().isForbidden());
        ecrire(delete("/api/communaute/questions/" + question), tiers).andExpect(status().isForbidden());
        ecrire(delete("/api/communaute/reponses/" + reponse), tiers).andExpect(status().isForbidden());
        ecrire(delete("/api/communaute/reponses/" + commentaire), tiers).andExpect(status().isForbidden());

        lire(question, tiers)
                .andExpect(jsonPath("$.modifie").value(false))
                .andExpect(jsonPath("$.reponses[0].modifie").value(false))
                .andExpect(jsonPath("$.reponses[0].commentaires.length()").value(1));
    }

    @Test
    void shouldMarkAnEditedMessageAsModified() throws Exception {
        UUID question = poser(auteur);
        UUID reponse = repondre(question, repondeur);
        lire(question, auteur).andExpect(jsonPath("$.modifie").value(false));

        ecrire(put("/api/communaute/questions/" + question),
                "{\"titre\":\"Nouveau titre\",\"corps\":" + CORPS + "}", auteur)
                .andExpect(status().isNoContent());
        ecrire(put("/api/communaute/reponses/" + reponse), REPONSE, repondeur).andExpect(status().isNoContent());

        lire(question, tiers)
                .andExpect(jsonPath("$.titre").value("Nouveau titre"))
                .andExpect(jsonPath("$.modifie").value(true))
                .andExpect(jsonPath("$.reponses[0].modifie").value(true));
    }

    @Test
    void shouldMakeADeletedQuestionUnreachableWithEverythingUnderIt() throws Exception {
        UUID question = poser(auteur);
        UUID reponse = repondre(question, repondeur);

        ecrire(delete("/api/communaute/questions/" + question), auteur).andExpect(status().isNoContent());

        lire(question, auteur).andExpect(status().isNotFound());
        ecrire(post("/api/communaute/questions/" + question + "/reponses"), REPONSE, tiers)
                .andExpect(status().isNotFound());
        ecrire(post("/api/communaute/reponses/" + reponse + "/commentaires"), REPONSE, tiers)
                .andExpect(status().isNotFound());
        ecrire(put("/api/communaute/reponses/" + reponse + "/vote"), tiers).andExpect(status().isNotFound());
    }

    @Test
    void shouldHideADeletedAnswerWithItsComments() throws Exception {
        UUID question = poser(auteur);
        UUID reponse = repondre(question, repondeur);
        commenter(reponse, tiers);

        ecrire(delete("/api/communaute/reponses/" + reponse), repondeur).andExpect(status().isNoContent());

        lire(question, auteur).andExpect(jsonPath("$.reponses.length()").value(0));
    }

    // ---- fil ------------------------------------------------------------------

    @Test
    void shouldAllowOnlyOneLevelOfComments() throws Exception {
        UUID reponse = repondre(poser(auteur), repondeur);
        UUID commentaire = commenter(reponse, tiers);

        ecrire(post("/api/communaute/reponses/" + commentaire + "/commentaires"), REPONSE, auteur)
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void shouldRejectABlockOutsideThePaletteOnEveryWrite() throws Exception {
        UUID question = poser(auteur);
        UUID reponse = repondre(question, repondeur);
        String image = "[{\"id\":\"i\",\"type\":\"image\",\"src\":\"https://x.test/a.png\"}]";

        ecrire(post("/api/communaute/questions"), "{\"titre\":\"T\",\"corps\":" + image + "}", auteur)
                .andExpect(status().isUnprocessableEntity());
        ecrire(put("/api/communaute/questions/" + question), "{\"titre\":\"T\",\"corps\":" + image + "}", auteur)
                .andExpect(status().isUnprocessableEntity());
        ecrire(post("/api/communaute/questions/" + question + "/reponses"), "{\"corps\":" + image + "}", tiers)
                .andExpect(status().isUnprocessableEntity());
        ecrire(post("/api/communaute/reponses/" + reponse + "/commentaires"), "{\"corps\":" + image + "}", tiers)
                .andExpect(status().isUnprocessableEntity());
        ecrire(put("/api/communaute/reponses/" + reponse), "{\"corps\":" + image + "}", repondeur)
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void shouldStoreAndReturnTheBodyAsBlocks() throws Exception {
        UUID question = poser(auteur);

        lire(question, tiers)
                .andExpect(jsonPath("$.corps[0].type").value("prose"))
                .andExpect(jsonPath("$.corps[0].text").value("Comment faire ?"));
    }

    @Test
    void shouldFilterTheListByLevelAndSubject() throws Exception {
        Compte cinquieme = Compte.creerEleve("cinq." + UUID.randomUUID(), "{noop}mdp", "p@test.fr", "5e",
                "Ours-" + UUID.randomUUID());
        cinquieme.activer();
        comptes.save(cinquieme);
        UUID en3e = poser(auteur);
        UUID en5e = poser(cinquieme);

        assertThat(idsListes("?niveau=3e&taille=50")).contains(en3e.toString()).doesNotContain(en5e.toString());
        assertThat(idsListes("?niveau=5e&taille=50")).contains(en5e.toString()).doesNotContain(en3e.toString());
        assertThat(idsListes("?matiere=mathematiques&taille=50")).contains(en3e.toString(), en5e.toString());
        assertThat(idsListes("?matiere=histoire&taille=50")).isEmpty();
        assertThat(idsListes("?taille=50")).contains(en3e.toString(), en5e.toString());
    }

    @Test
    void shouldRejectAnUnknownSubject() throws Exception {
        ecrire(post("/api/communaute/questions"),
                "{\"titre\":\"T\",\"corps\":" + CORPS + ",\"matiere\":\"histoire\"}", auteur)
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void shouldReportCountsAndTheCallersOwnStateInTheList() throws Exception {
        UUID question = poser(auteur);
        UUID reponse = repondre(question, repondeur);
        commenter(reponse, tiers); // a comment is not an answer
        ecrire(put("/api/communaute/questions/" + question + "/vote"), tiers).andExpect(status().isNoContent());

        JsonNode resume = resumeDe(question, tiers);

        assertThat(resume.get("nombreReponses").asLong()).isEqualTo(1);
        assertThat(resume.get("nombreUtile").asLong()).isEqualTo(1);
        assertThat(resume.get("aVote").asBoolean()).isTrue();
        assertThat(resume.get("estAuteur").asBoolean()).isFalse();
        assertThat(resumeDe(question, auteur).get("estAuteur").asBoolean()).isTrue();
    }

    // ---- vote -----------------------------------------------------------------

    @Test
    void shouldCountOneVotePerStudentAndLetThemTakeItBack() throws Exception {
        UUID question = poser(auteur);
        UUID reponse = repondre(question, repondeur);

        for (int i = 0; i < 2; i++) {
            ecrire(put("/api/communaute/questions/" + question + "/vote"), tiers).andExpect(status().isNoContent());
            ecrire(put("/api/communaute/reponses/" + reponse + "/vote"), tiers).andExpect(status().isNoContent());
        }
        lire(question, tiers)
                .andExpect(jsonPath("$.nombreUtile").value(1))
                .andExpect(jsonPath("$.aVote").value(true))
                .andExpect(jsonPath("$.reponses[0].nombreUtile").value(1))
                .andExpect(jsonPath("$.reponses[0].aVote").value(true));

        ecrire(delete("/api/communaute/questions/" + question + "/vote"), tiers).andExpect(status().isNoContent());
        ecrire(delete("/api/communaute/reponses/" + reponse + "/vote"), tiers).andExpect(status().isNoContent());
        lire(question, tiers)
                .andExpect(jsonPath("$.nombreUtile").value(0))
                .andExpect(jsonPath("$.reponses[0].nombreUtile").value(0));
    }

    @Test
    void shouldRefuseAVoteOnOnesOwnMessage() throws Exception {
        UUID question = poser(auteur);
        UUID reponse = repondre(question, repondeur);

        ecrire(put("/api/communaute/questions/" + question + "/vote"), auteur).andExpect(status().isForbidden());
        ecrire(put("/api/communaute/reponses/" + reponse + "/vote"), repondeur).andExpect(status().isForbidden());

        lire(question, tiers)
                .andExpect(jsonPath("$.nombreUtile").value(0))
                .andExpect(jsonPath("$.reponses[0].nombreUtile").value(0));
    }

    @Test
    void shouldRefuseAVoteOnAComment() throws Exception {
        UUID commentaire = commenter(repondre(poser(auteur), repondeur), repondeur);

        ecrire(put("/api/communaute/reponses/" + commentaire + "/vote"), tiers)
                .andExpect(status().isUnprocessableEntity());
    }

    // ---- résolution -------------------------------------------------------------

    @Test
    void shouldLetOnlyTheQuestionsAuthorResolveIt() throws Exception {
        UUID question = poser(auteur);
        UUID reponse = repondre(question, repondeur);

        ecrire(post(resolution(question, reponse)), tiers).andExpect(status().isForbidden());
        ecrire(post(resolution(question, reponse)), repondeur).andExpect(status().isForbidden());

        lire(question, auteur).andExpect(jsonPath("$.resolue").value(false));
        assertThat(evenements.stream(ReponseUtileValidee.class)).isEmpty();
    }

    @Test
    void shouldNotLetAnAuthorRetainTheirOwnAnswerOrAComment() throws Exception {
        UUID question = poser(auteur);
        UUID sienne = repondre(question, auteur);
        UUID commentaire = commenter(repondre(question, repondeur), tiers);

        ecrire(post(resolution(question, sienne)), auteur).andExpect(status().isUnprocessableEntity());
        ecrire(post(resolution(question, commentaire)), auteur).andExpect(status().isUnprocessableEntity());

        assertThat(evenements.stream(ReponseUtileValidee.class)).isEmpty();
    }

    @Test
    void shouldNotResolveWithAnAnswerFromAnotherQuestion() throws Exception {
        UUID question = poser(auteur);
        UUID ailleurs = repondre(poser(tiers), repondeur);

        ecrire(post(resolution(question, ailleurs)), auteur).andExpect(status().isNotFound());
    }

    @Test
    void shouldCreditTheXpOnlyOnceWhenTheSameAnswerIsMarkedTwice() throws Exception {
        UUID question = poser(auteur);
        UUID reponse = repondre(question, repondeur);

        ecrire(post(resolution(question, reponse)), auteur).andExpect(status().isNoContent());
        ecrire(post(resolution(question, reponse)), auteur).andExpect(status().isNoContent());

        assertThat(evenements.stream(ReponseUtileValidee.class)).hasSize(1);
        await().atMost(Duration.ofSeconds(10))
                .until(() -> progression.pour(repondeur.getId()).xpTotal() == 15);
        Thread.sleep(500); // a second credit would come through the same asynchronous listener
        assertThat(progression.pour(repondeur.getId()).xpTotal()).isEqualTo(15);
        assertThat(progression.pour(auteur.getId()).xpTotal()).isZero();
        lire(question, tiers)
                .andExpect(jsonPath("$.resolue").value(true))
                .andExpect(jsonPath("$.reponses[0].aResolu").value(true));
    }

    @Test
    void shouldRefuseASecondAnswerOnAResolvedQuestion() throws Exception {
        UUID question = poser(auteur);
        UUID premiere = repondre(question, repondeur);
        UUID seconde = repondre(question, tiers);
        ecrire(post(resolution(question, premiere)), auteur).andExpect(status().isNoContent());

        ecrire(post(resolution(question, seconde)), auteur).andExpect(status().isConflict());

        assertThat(evenements.stream(ReponseUtileValidee.class)).hasSize(1);
    }

    @Test
    void shouldReopenAQuestionWhenItsResolvingAnswerIsDeleted() throws Exception {
        UUID question = poser(auteur);
        UUID reponse = repondre(question, repondeur);
        ecrire(post(resolution(question, reponse)), auteur).andExpect(status().isNoContent());

        ecrire(delete("/api/communaute/reponses/" + reponse), repondeur).andExpect(status().isNoContent());

        lire(question, auteur).andExpect(jsonPath("$.resolue").value(false));
    }

    // ---- identité ---------------------------------------------------------------

    @Test
    void shouldNeverReturnADisplayNameOrAnAccountIdInAnyCommunauteResponse() throws Exception {
        UUID question = poser(auteur);
        UUID reponse = repondre(question, repondeur);
        commenter(reponse, repondeur);

        List<String> corps = new ArrayList<>();
        corps.add(texte(mockMvc.perform(get("/api/communaute/questions?taille=50").with(comme(auteur)))));
        corps.add(texte(lire(question, auteur)));
        corps.add(texte(lire(question, repondeur)));
        corps.add(texte(ecrire(post("/api/communaute/questions"), QUESTION, auteur)));
        corps.add(texte(ecrire(post("/api/communaute/questions/" + question + "/reponses"), REPONSE, repondeur)));
        corps.add(texte(ecrire(post("/api/communaute/reponses/" + reponse + "/commentaires"), REPONSE, repondeur)));

        assertThat(corps).allSatisfy(r -> assertThat(r)
                .doesNotContain(NOM_AFFICHE, NOM_AFFICHE_REPONDEUR)
                .doesNotContain(auteur.getId().toString(), repondeur.getId().toString())
                .doesNotContain("nomAffiche", "auteurId"));
        assertThat(corps.get(1)).contains(auteur.getPseudonyme(), repondeur.getPseudonyme(), "3e");
    }

    /** Guards every Communauté schema, including those added later. */
    @Test
    void shouldKeepTheDisplayNameOutOfTheContract() throws Exception {
        JsonNode schemas = json
                .readTree(mockMvc.perform(get("/v3/api-docs")).andReturn().getResponse().getContentAsString())
                .path("components").path("schemas");

        List<String> avecPseudonyme = new ArrayList<>();
        schemas.fields().forEachRemaining(schema -> {
            JsonNode proprietes = schema.getValue().path("properties");
            if (proprietes.has("pseudonyme")) {
                avecPseudonyme.add(schema.getKey());
                assertThat(proprietes.has("nomAffiche")).as(schema.getKey()).isFalse();
            }
            if (schema.getKey().contains("Communaute")) {
                assertThat(proprietes.has("nomAffiche")).as(schema.getKey()).isFalse();
                assertThat(proprietes.has("auteurId")).as(schema.getKey()).isFalse();
            }
        });

        assertThat(avecPseudonyme).containsExactlyInAnyOrder("CompteInfo", "PseudonymeInfo", "AuteurCommunaute");
    }

    // ---- aides ------------------------------------------------------------------

    private static String resolution(UUID question, UUID reponse) {
        return "/api/communaute/questions/" + question + "/reponses/" + reponse + "/resolution";
    }

    private UUID poser(Compte qui) throws Exception {
        return id(ecrire(post("/api/communaute/questions"), QUESTION, qui).andExpect(status().isCreated()));
    }

    private UUID repondre(UUID question, Compte qui) throws Exception {
        return id(ecrire(post("/api/communaute/questions/" + question + "/reponses"), REPONSE, qui)
                .andExpect(status().isCreated()));
    }

    private UUID commenter(UUID reponse, Compte qui) throws Exception {
        return id(ecrire(post("/api/communaute/reponses/" + reponse + "/commentaires"), REPONSE, qui)
                .andExpect(status().isCreated()));
    }

    private ResultActions lire(UUID question, Compte qui) throws Exception {
        return mockMvc.perform(get("/api/communaute/questions/" + question).with(comme(qui)));
    }

    private ResultActions ecrire(
            MockHttpServletRequestBuilder requete, String contenu, Compte qui) throws Exception {
        return mockMvc.perform(requete.contentType("application/json").content(contenu).with(comme(qui)).with(csrf()));
    }

    private ResultActions ecrire(
            MockHttpServletRequestBuilder requete, Compte qui) throws Exception {
        return mockMvc.perform(requete.with(comme(qui)).with(csrf()));
    }

    private List<String> idsListes(String filtre) throws Exception {
        List<String> ids = new ArrayList<>();
        json.readTree(texte(mockMvc.perform(get("/api/communaute/questions" + filtre).with(comme(tiers)))))
                .path("questions").forEach(q -> ids.add(q.get("id").asText()));
        return ids;
    }

    private JsonNode resumeDe(UUID question, Compte qui) throws Exception {
        for (JsonNode q : json.readTree(texte(mockMvc.perform(
                get("/api/communaute/questions?taille=50").with(comme(qui))))).path("questions")) {
            if (q.get("id").asText().equals(question.toString())) {
                return q;
            }
        }
        throw new AssertionError("Question absente de la liste : " + question);
    }

    private UUID id(ResultActions resultat) throws Exception {
        return UUID.fromString(json.readTree(texte(resultat)).get("id").asText());
    }

    private static String texte(ResultActions resultat) throws Exception {
        return resultat.andReturn().getResponse().getContentAsString();
    }

    private static RequestPostProcessor comme(Compte qui) {
        String role = qui.getRole().name().equals("eleve") ? "ELEVE" : "ENSEIGNANT";
        return user(qui.getId().toString()).roles(role);
    }
}
