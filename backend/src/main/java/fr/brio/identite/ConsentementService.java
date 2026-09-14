package fr.brio.identite;

import fr.brio.identite.api.EmailSender;
import fr.brio.identite.domain.Consentement;
import fr.brio.identite.domain.DemandeConsentement;
import fr.brio.identite.infrastructure.CompteRepository;
import fr.brio.identite.infrastructure.ConsentementRepository;
import fr.brio.identite.infrastructure.DemandeConsentementRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class ConsentementService {

    static final String TYPE_PARENTAL = "parental_v1";

    private final CompteRepository comptes;
    private final ConsentementRepository consentements;
    private final DemandeConsentementRepository demandes;
    private final EmailSender emailSender;
    private final String frontendBaseUrl;

    ConsentementService(CompteRepository comptes,
                        ConsentementRepository consentements,
                        DemandeConsentementRepository demandes,
                        EmailSender emailSender,
                        @Value("${brio.frontend.base-url:http://localhost:3000}") String frontendBaseUrl) {
        this.comptes = comptes;
        this.consentements = consentements;
        this.demandes = demandes;
        this.emailSender = emailSender;
        this.frontendBaseUrl = frontendBaseUrl;
    }

    /**
     * Creates (or replaces) a pending consent request for an élève account.
     * A new call invalidates any previous pending token for the same (compte, type).
     * Intended to be called by a teacher or admin; not by the student themselves.
     */
    @Transactional
    public void envoyerDemandeConsentement(UUID compteId) {
        var compte = comptes.findById(compteId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        String parentEmail = compte.getEmailTitulaireLegal();
        if (parentEmail == null) {
            throw new IllegalStateException("Compte without email_titulaire_legal: " + compteId);
        }

        String token = generateToken();
        String hash = hashToken(token);

        // Invalidate any previous pending demand for this (compte, type) pair.
        demandes.findByIdCompteIdAndIdType(compteId, TYPE_PARENTAL)
                .ifPresent(demandes::delete);

        demandes.save(DemandeConsentement.creer(compteId, TYPE_PARENTAL, hash, parentEmail));

        emailSender.sendConsentEmail(parentEmail,
                frontendBaseUrl + "/consentement/" + token);
    }

    /**
     * Validates the bearer token from the parent confirmation email.
     * Single-use: the demande_consentement row is deleted on success.
     * On success: compte becomes actif; a revocation link is sent to the parent.
     */
    @Transactional
    public void validerConsentement(String token) {
        String hash = hashToken(token);
        var demande = demandes.findByTokenHash(hash)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lien invalide"));

        if (demande.isExpire()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lien expiré");
        }

        var compte = comptes.findById(demande.getId().compteId())
                .orElseThrow(() -> new IllegalStateException("Compte disparu entre demande et validation"));

        String revocationToken = generateToken();
        String revocationHash = hashToken(revocationToken);

        consentements.save(Consentement.creer(
                compte.getId(), demande.getId().type(),
                demande.getEnvoyeA(), hash, revocationHash));

        compte.activer();

        demandes.delete(demande);

        emailSender.sendConsentConfirmationEmail(
                demande.getEnvoyeA(),
                frontendBaseUrl + "/consentement/revocation/" + revocationToken);
    }

    /**
     * Revokes consent via the parent's bearer token (from the confirmation email).
     * Sets compte to suspendu; the StatutCheckFilter invalidates the live session
     * on the next request.
     */
    @Transactional
    public void revoquerConsentementParent(String token) {
        String hash = hashToken(token);
        var consentement = consentements.findByRevocationTokenHash(hash)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lien invalide"));

        if (consentement.isRevoque()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Consentement déjà révoqué");
        }

        consentement.revoquer();
        suspendreCompte(consentement.getId().compteId());
    }

    /**
     * Revokes consent via an admin action (authenticated endpoint).
     * Suspends all consent types for the given compte.
     */
    @Transactional
    public void revoquerConsentementAdmin(UUID compteId) {
        if (!comptes.existsById(compteId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        consentements.findByIdCompteId(compteId).forEach(Consentement::revoquer);
        suspendreCompte(compteId);
    }

    private void suspendreCompte(UUID compteId) {
        comptes.findById(compteId).ifPresent(c -> {
            c.suspendre();
            comptes.save(c);
        });
    }

    private static String generateToken() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String hashToken(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
