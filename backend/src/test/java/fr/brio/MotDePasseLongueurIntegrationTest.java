package fr.brio;

import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.identite.ClasseService;
import fr.brio.identite.api.MotDePasseHachable;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.infrastructure.CompteRepository;
import fr.brio.identite.infrastructure.RecordingEmailSender;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Every signup that hashes a typed password refuses more than 72 BYTES of UTF-8 with a 400 that
 * says what to change, never a 500 from bcrypt (#368). Accents count two bytes, emojis four.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MotDePasseLongueurIntegrationTest {

    private static final String EMOJI = "😀"; // 😀, 4 bytes of UTF-8
    private static final ObjectMapper JSON = new ObjectMapper();

    @Autowired MockMvc mockMvc;
    @Autowired ClasseService classeService;
    @Autowired CompteRepository compteRepository;
    @Autowired RecordingEmailSender emailSender;

    private UUID etablissementId;
    private String codeClasse;

    @BeforeEach
    void setup() {
        emailSender.clear();
        String suffixe = UUID.randomUUID().toString().substring(0, 8);
        Compte admin = compteRepository.save(Compte.creerAdminBrio(
                "admin.mdp." + suffixe, "{noop}admin123", "Admin", "admin." + suffixe + "@brio.fr"));
        etablissementId = classeService.creerEtablissement(
                "Collège Longueur", null, "college", LocalDate.of(2026, 9, 1), "CONV-MDP-" + suffixe).id();
        UUID classeId = classeService.creerClasse(etablissementId, "4e", "4e L", "2026-2027", null).id();
        codeClasse = classeService.genererCode(classeId, admin.getId(), 14, 40).code();
    }

    // ── Élève, consentement parent : POST /api/comptes/eleve ────────────────────

    @Test
    void givenSeventyTwoAsciiBytes_whenEleveSignsUp_thenCreated() throws Exception {
        inscrireEleve("a".repeat(72)).andExpect(status().isCreated());
    }

    @Test
    void givenSeventyThreeAsciiBytes_whenEleveSignsUp_then400TropLongAndNothingCreated() throws Exception {
        long avant = compteRepository.count();
        inscrireEleve("a".repeat(73))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString(MotDePasseHachable.MESSAGE_TU)));
        assertThat(compteRepository.count()).isEqualTo(avant);
        assertThat(emailSender.getSent()).isEmpty();
    }

    @Test
    void givenThirtySevenAccentedLetters_whenEleveSignsUp_then400() throws Exception {
        inscrireEleve("é".repeat(37)) // 37 characters, 74 bytes
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString(MotDePasseHachable.MESSAGE_TU)));
    }

    @Test
    void givenThirtySixAccentedLetters_whenEleveSignsUp_thenCreated() throws Exception {
        inscrireEleve("é".repeat(36)).andExpect(status().isCreated()); // 72 bytes
    }

    @Test
    void givenEighteenEmojis_whenEleveSignsUp_thenCreated_andNineteen_then400() throws Exception {
        inscrireEleve(EMOJI.repeat(18)).andExpect(status().isCreated()); // 72 bytes
        inscrireEleve(EMOJI.repeat(19)).andExpect(status().isBadRequest()); // 76 bytes
    }

    @Test
    void givenTwoHundredPastedEmojis_whenEleveSignsUp_then400NotServerError() throws Exception {
        inscrireEleve(EMOJI.repeat(200)).andExpect(status().isBadRequest()); // 800 bytes
    }

    @Test
    void givenTenThousandCharacters_whenEleveSignsUp_then400NotServerError() throws Exception {
        inscrireEleve("a".repeat(10_000)).andExpect(status().isBadRequest());
    }

    // ── Élève, code de classe : POST /api/classes/rejoindre ────────────────────

    @Test
    void givenSeventyTwoBytes_whenEleveJoinsWithCode_thenCreatedAndCanLogIn() throws Exception {
        String motDePasse = "é".repeat(36); // 72 bytes
        String reponse = rejoindre(motDePasse).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        SessionCookies.login(mockMvc, JSON.readTree(reponse).path("identifiantConnexion").asText(), motDePasse);
    }

    @Test
    void givenSeventyThreeBytes_whenEleveJoinsWithCode_then400TropLongAndNothingCreated() throws Exception {
        long avant = compteRepository.count();
        rejoindre("a".repeat(73))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString(MotDePasseHachable.MESSAGE_TU)));
        rejoindre("é".repeat(37)).andExpect(status().isBadRequest());
        rejoindre(EMOJI.repeat(200)).andExpect(status().isBadRequest());
        rejoindre("a".repeat(10_000)).andExpect(status().isBadRequest());
        assertThat(compteRepository.count()).isEqualTo(avant);
    }

    // ── Enseignant : POST /api/comptes ──────────────────────────────────────────

    @Test
    void givenSeventyTwoBytes_whenEnseignantSignsUp_thenCreatedAndCanLogIn() throws Exception {
        String email = "prof.long." + UUID.randomUUID().toString().substring(0, 8) + "@ecole.fr";
        String motDePasse = "é".repeat(36); // 72 bytes
        inscrireEnseignant(motDePasse, email).andExpect(status().isCreated());
        SessionCookies.login(mockMvc, email, motDePasse);
    }

    @Test
    void givenSeventyThreeBytes_whenEnseignantSignsUp_then400InFormalFrench() throws Exception {
        long avant = compteRepository.count();
        inscrireEnseignant("a".repeat(73), "prof.trop.long@ecole.fr")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString(MotDePasseHachable.MESSAGE_VOUS)));
        inscrireEnseignant("é".repeat(37), "prof.trop.long@ecole.fr").andExpect(status().isBadRequest());
        inscrireEnseignant(EMOJI.repeat(200), "prof.trop.long@ecole.fr").andExpect(status().isBadRequest());
        inscrireEnseignant("a".repeat(10_000), "prof.trop.long@ecole.fr").andExpect(status().isBadRequest());
        assertThat(compteRepository.count()).isEqualTo(avant);
    }

    // ── helpers ─────────────────────────────────────────────────────────────────

    private ResultActions inscrireEleve(String motDePasse) throws Exception {
        return envoyer("/api/comptes/eleve", Map.of(
                "niveauDeclare", "4e", "motDePasse", motDePasse, "emailParent", "parent@example.com"));
    }

    private ResultActions rejoindre(String motDePasse) throws Exception {
        return envoyer("/api/classes/rejoindre", Map.of(
                "code", codeClasse, "motDePasse", motDePasse, "nomAffiche", "Léa"));
    }

    private ResultActions inscrireEnseignant(String motDePasse, String email) throws Exception {
        Map<String, Object> corps = new LinkedHashMap<>();
        corps.put("motDePasse", motDePasse);
        corps.put("nom", "Martin");
        corps.put("email", email);
        corps.put("etablissementId", etablissementId.toString());
        return envoyer("/api/comptes", corps);
    }

    private ResultActions envoyer(String route, Map<String, ?> corps) throws Exception {
        return mockMvc.perform(post(route)
                .contentType(MediaType.APPLICATION_JSON)
                .content(JSON.writeValueAsString(corps)));
    }
}
