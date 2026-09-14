package fr.brio.identite;

import fr.brio.identite.api.CompteInfo;
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

    public CompteService(CompteRepository comptes, PasswordEncoder passwordEncoder) {
        this.comptes = comptes;
        this.passwordEncoder = passwordEncoder;
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

    private static CompteInfo toInfo(Compte c) {
        return new CompteInfo(c.getId(), c.getRole().name(), c.getStatut().name(),
                c.getNom(), c.getEmail());
    }
}
