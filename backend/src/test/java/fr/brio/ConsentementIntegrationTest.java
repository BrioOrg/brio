package fr.brio;

import fr.brio.identite.CompteService;
import fr.brio.identite.ConsentementService;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.domain.StatutCompte;
import fr.brio.identite.infrastructure.CompteRepository;
import fr.brio.identite.infrastructure.RecordingEmailSender;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ConsentementIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired CompteRepository compteRepository;
    @Autowired CompteService compteService;
    @Autowired ConsentementService consentementService;
    @Autowired RecordingEmailSender emailSender;

    private Compte eleveEnAttente;

    @BeforeEach
    void setup() {
        emailSender.clear();
        eleveEnAttente = compteRepository.save(
                Compte.creerEleve("eleve.consent.test", "{noop}motdepasse", "parent@example.fr"));
    }

    // ── Confirmation flow ──────────────────────────────────────────────────────

    @Test
    void shouldSendConsentEmailOnDemande() {
        consentementService.envoyerDemandeConsentement(eleveEnAttente.getId());

        var sent = emailSender.getSent();
        assertThat(sent).hasSize(1);
        assertThat(sent.get(0).to()).isEqualTo("parent@example.fr");
        assertThat(sent.get(0).kind()).isEqualTo("consent-request");
        assertThat(sent.get(0).url()).contains("/consentement/");
    }

    @Test
    void shouldActivateAccountOnValidation() throws Exception {
        consentementService.envoyerDemandeConsentement(eleveEnAttente.getId());
        String confirmUrl = emailSender.getSent().get(0).url();
        String token = extractTokenFromUrl(confirmUrl);

        mockMvc.perform(post("/api/consentements/{token}/validation", token))
                .andExpect(status().isOk());

        var compte = compteRepository.findById(eleveEnAttente.getId()).orElseThrow();
        assertThat(compte.getStatut()).isEqualTo(StatutCompte.actif);
    }

    @Test
    void shouldSendRevocationEmailAfterConfirmation() throws Exception {
        consentementService.envoyerDemandeConsentement(eleveEnAttente.getId());
        String token = extractTokenFromUrl(emailSender.getSent().get(0).url());

        mockMvc.perform(post("/api/consentements/{token}/validation", token))
                .andExpect(status().isOk());

        assertThat(emailSender.getSent()).hasSize(2);
        var revocationEmail = emailSender.getSent().get(1);
        assertThat(revocationEmail.to()).isEqualTo("parent@example.fr");
        assertThat(revocationEmail.kind()).isEqualTo("consent-confirmed");
        assertThat(revocationEmail.url()).contains("/consentement/revocation/");
    }

    @Test
    void shouldRejectTokenOnSecondUse() throws Exception {
        consentementService.envoyerDemandeConsentement(eleveEnAttente.getId());
        String token = extractTokenFromUrl(emailSender.getSent().get(0).url());

        mockMvc.perform(post("/api/consentements/{token}/validation", token))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/consentements/{token}/validation", token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldInvalidatePreviousTokenOnResend() throws Exception {
        consentementService.envoyerDemandeConsentement(eleveEnAttente.getId());
        String firstToken = extractTokenFromUrl(emailSender.getSent().get(0).url());

        consentementService.envoyerDemandeConsentement(eleveEnAttente.getId());
        String secondToken = extractTokenFromUrl(emailSender.getSent().get(1).url());

        mockMvc.perform(post("/api/consentements/{token}/validation", firstToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/consentements/{token}/validation", secondToken))
                .andExpect(status().isOk());
    }

    @Test
    void shouldReturn400ForUnknownToken() throws Exception {
        mockMvc.perform(post("/api/consentements/{token}/validation", "completement-inconnu"))
                .andExpect(status().isBadRequest());
    }

    // ── Revocation flow ───────────────────────────────────────────────────────

    @Test
    void shouldSuspendAccountOnParentRevocation() throws Exception {
        consentementService.envoyerDemandeConsentement(eleveEnAttente.getId());
        String confirmToken = extractTokenFromUrl(emailSender.getSent().get(0).url());
        mockMvc.perform(post("/api/consentements/{token}/validation", confirmToken))
                .andExpect(status().isOk());

        String revocationToken = extractTokenFromUrl(emailSender.getSent().get(1).url());
        mockMvc.perform(post("/api/consentements/revocation/{token}", revocationToken))
                .andExpect(status().isOk());

        var compte = compteRepository.findById(eleveEnAttente.getId()).orElseThrow();
        assertThat(compte.getStatut()).isEqualTo(StatutCompte.suspendu);
    }

    @Test
    void shouldReturn409OnDoubleRevocation() throws Exception {
        consentementService.envoyerDemandeConsentement(eleveEnAttente.getId());
        String confirmToken = extractTokenFromUrl(emailSender.getSent().get(0).url());
        mockMvc.perform(post("/api/consentements/{token}/validation", confirmToken))
                .andExpect(status().isOk());

        String revocationToken = extractTokenFromUrl(emailSender.getSent().get(1).url());
        mockMvc.perform(post("/api/consentements/revocation/{token}", revocationToken))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/consentements/revocation/{token}", revocationToken))
                .andExpect(status().isConflict());
    }

    @Test
    void shouldSuspendAccountOnAdminRevocation() throws Exception {
        consentementService.envoyerDemandeConsentement(eleveEnAttente.getId());
        String confirmToken = extractTokenFromUrl(emailSender.getSent().get(0).url());
        mockMvc.perform(post("/api/consentements/{token}/validation", confirmToken))
                .andExpect(status().isOk());

        // Admin-authenticated request
        Compte admin = compteRepository.save(
                Compte.creerEnseignant("admin.brio", "{noop}admin123", "Admin", "admin@brio.fr"));

        UUID eleveId = eleveEnAttente.getId();
        var session = new MockHttpSession();
        mockMvc.perform(post("/api/sessions")
                        .session(session)
                        .contentType("application/x-www-form-urlencoded")
                        .param("identifiant", "admin.brio")
                        .param("mot_de_passe", "admin123")
                        .with(csrf()))
                .andExpect(status().isOk());

        // Enseignant role doesn't have ADMIN_BRIO — should be 403
        mockMvc.perform(delete("/api/comptes/{id}/consentement", eleveId)
                        .session(session)
                        .with(csrf()))
                .andExpect(status().isForbidden());
    }

    // ── StatutCheckFilter ─────────────────────────────────────────────────────

    @Test
    void shouldInvalidateSessionAfterRevocation() throws Exception {
        // 1. Confirm consent → account actif
        consentementService.envoyerDemandeConsentement(eleveEnAttente.getId());
        String confirmToken = extractTokenFromUrl(emailSender.getSent().get(0).url());
        mockMvc.perform(post("/api/consentements/{token}/validation", confirmToken))
                .andExpect(status().isOk());

        // 2. Log in with the now-active account
        var session = new MockHttpSession();
        mockMvc.perform(post("/api/sessions")
                        .session(session)
                        .contentType("application/x-www-form-urlencoded")
                        .param("identifiant", "eleve.consent.test")
                        .param("mot_de_passe", "motdepasse")
                        .with(csrf()))
                .andExpect(status().isOk());

        // 3. Active session works
        mockMvc.perform(get("/api/moi").session(session))
                .andExpect(status().isOk());

        // 4. Revoke consent
        String revocationToken = extractTokenFromUrl(emailSender.getSent().get(1).url());
        mockMvc.perform(post("/api/consentements/revocation/{token}", revocationToken))
                .andExpect(status().isOk());

        // 5. Same session cookie now rejected by StatutCheckFilter
        mockMvc.perform(get("/api/moi").session(session))
                .andExpect(status().isUnauthorized());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static String extractTokenFromUrl(String url) {
        return url.substring(url.lastIndexOf('/') + 1);
    }
}
