package fr.brio.identite.infrastructure;

import fr.brio.identite.domain.Compte;
import fr.brio.identite.domain.StatutCompte;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

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
                .or(() -> comptes.findByEmailIgnoreCase(identifiantConnexion.trim()))
                .orElseThrow(() -> new UsernameNotFoundException("Compte introuvable"));

        return User.builder()
                .username(compte.getId().toString())
                .password(compte.getMotDePasseHash())
                .authorities(List.of(new SimpleGrantedAuthority("ROLE_" + compte.getRole().name().toUpperCase())))
                .disabled(compte.getStatut() == StatutCompte.en_attente_consentement
                        || compte.getStatut() == StatutCompte.clos)
                .accountLocked(compte.getStatut() == StatutCompte.suspendu)
                // An expired or already-used provisional password (ADR 0036 §3). Spring checks this
                // only AFTER the password matched, and the single failure handler answers it exactly
                // like a wrong password (same 401 body, same lockout count): no enumeration (§4).
                .credentialsExpired(compte.provisoireInutilisable(Instant.now()))
                .build();
    }
}
