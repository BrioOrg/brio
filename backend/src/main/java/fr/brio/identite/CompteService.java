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

import java.util.Locale;
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
     * consent needed (ADR 0016 §5). The normalised e-mail doubles as the
     * identifiant_connexion: a teacher signs up and logs in with their e-mail.
     *
     * @throws ResponseStatusException 409 if an account already uses this e-mail
     */
    @Transactional
    public CompteInfo creerEnseignant(String motDePasse, String nom, String email) {
        String emailNormalise = email.trim().toLowerCase(Locale.ROOT);
        if (comptes.existsByEmailIgnoreCase(emailNormalise)
                || comptes.findByIdentifiantConnexion(emailNormalise).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "E-mail déjà utilisé");
        }
        String hash = passwordEncoder.encode(motDePasse);
        Compte compte = comptes.save(
                Compte.creerEnseignant(emailNormalise, hash, nom.trim(), emailNormalise));
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
     * The consent e-mail leaves after commit (ConsentementEmailListener).
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
