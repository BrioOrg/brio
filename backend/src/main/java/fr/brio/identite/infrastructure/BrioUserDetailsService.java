package fr.brio.identite.infrastructure;

import fr.brio.identite.IdentifiantConnexion;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.domain.StatutCompte;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
class BrioUserDetailsService implements UserDetailsService {

    private final CompteRepository comptes;

    BrioUserDetailsService(CompteRepository comptes) {
        this.comptes = comptes;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String identifiantConnexion) {
        // Adults may type their e-mail instead of their identifiant; élèves have no e-mail.
        Compte compte = comptes.findByIdentifiantConnexion(identifiantConnexion)
                .or(() -> identifiantTolerant(identifiantConnexion))
                .or(() -> comptes.findByEmailIgnoreCase(identifiantConnexion.trim()))
                .orElseThrow(() -> new UsernameNotFoundException("Compte introuvable"));

        return new CompteUserDetails(
                compte.getId().toString(),
                compte.getMotDePasseHash(),
                !(compte.getStatut() == StatutCompte.en_attente_consentement
                        || compte.getStatut() == StatutCompte.clos),
                // An expired or already-used provisional password (ADR 0036 §3). Spring checks this
                // only AFTER the password matched, and the single failure handler answers it exactly
                // like a wrong password (same 401 body, same lockout count): no enumeration (§4).
                !compte.provisoireInutilisable(Instant.now()),
                compte.getStatut() != StatutCompte.suspendu,
                List.of(new SimpleGrantedAuthority("ROLE_" + compte.getRole().name().toUpperCase())),
                // The reset state this password is checked against: the success handler consumes
                // the provisional password only if it is still this one (ADR 0036 §3).
                compte.getAccesReinitialiseLe());
    }

    /**
     * The identifier typed loosely — grouped with spaces as the teacher read it out, or with a
     * capital from a phone keyboard (#364). Only tried when the exact lookup failed, and never for
     * an e-mail ({@code @}): a login by e-mail keeps its own lookup, unchanged. Every stored
     * identifier is already in this form, and unique: at most one account can match.
     */
    private Optional<Compte> identifiantTolerant(String saisi) {
        String normalise = IdentifiantConnexion.normaliser(saisi);
        if (normalise == null || saisi.indexOf('@') >= 0 || normalise.equals(saisi)) {
            return Optional.empty();
        }
        return comptes.findByIdentifiantConnexion(normalise);
    }
}
