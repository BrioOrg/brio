package fr.brio.identite;

import fr.brio.identite.api.CompteInfo;
import fr.brio.identite.api.InscriptionEleveEnAttenteInfo;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.domain.StatutCompte;
import fr.brio.identite.infrastructure.CompteRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.UUID;

@Service
public class CompteService {

    private final CompteRepository comptes;
    private final PasswordEncoder passwordEncoder;
    private final IdentifiantGenerator identifiantGenerator;
    private final ConsentementService consentementService;

    public CompteService(CompteRepository comptes,
                         PasswordEncoder passwordEncoder,
                         IdentifiantGenerator identifiantGenerator,
                         ConsentementService consentementService) {
        this.comptes = comptes;
        this.passwordEncoder = passwordEncoder;
        this.identifiantGenerator = identifiantGenerator;
        this.consentementService = consentementService;
    }

    @Transactional(readOnly = true)
    public Optional<Compte> findById(UUID id) {
        return comptes.findById(id);
    }

    @Transactional
    public Compte save(Compte compte) {
        return comptes.save(compte);
    }

    /**
     * Creates an enseignant account. Adults are active immediately — no parental
     * consent needed (ADR 0016 §5).
     *
     * @throws ResponseStatusException 409 if identifiantConnexion is already taken
     */
    @Transactional
    public CompteInfo creerEnseignant(String identifiantConnexion, String motDePasse,
                                      String nom, String email) {
        if (comptes.findByIdentifiantConnexion(identifiantConnexion).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Identifiant déjà utilisé");
        }
        String hash = passwordEncoder.encode(motDePasse);
        Compte compte = comptes.save(Compte.creerEnseignant(identifiantConnexion, hash, nom, email));
        return toInfo(compte);
    }

    /**
     * Returns true only when the compte exists and its statut is actif.
     * Used by StatutCheckFilter to enforce immediate revocation on every request.
     */
    @Transactional(readOnly = true)
    public boolean estActif(UUID id) {
        return comptes.findById(id)
                .map(c -> c.getStatut() == StatutCompte.actif)
                .orElse(false);
    }

    /**
     * Path B enrollment (ADR 0018 §1 — consent path).
     * Creates an élève account in en_attente_consentement and immediately sends the
     * parent consent email. The identifiantConnexion is returned once so the student
     * can note it; the account becomes active only after the parent validates the link.
     *
     * Note: the email send happens inside the transaction. Once a real SMTP sender is
     * wired in, move it to an ApplicationEvent fired on commit to avoid sending on rollback.
     */
    @Transactional
    public InscriptionEleveEnAttenteInfo inscrireEleve(String niveauDeclare, String motDePasse,
                                                        String emailParent) {
        String identifiant = identifiantGenerator.generateUnique();
        String hash = passwordEncoder.encode(motDePasse);
        Compte compte = comptes.save(
                Compte.creerEleve(identifiant, hash, emailParent, niveauDeclare));
        consentementService.envoyerDemandeConsentement(compte.getId());
        return new InscriptionEleveEnAttenteInfo(
                compte.getId(), identifiant, compte.getStatut().name());
    }

    private static CompteInfo toInfo(Compte c) {
        return new CompteInfo(c.getId(), c.getRole().name(), c.getStatut().name(),
                c.getNom(), c.getEmail());
    }
}
