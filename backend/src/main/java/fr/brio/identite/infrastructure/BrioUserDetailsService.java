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
        Compte compte = comptes.findByIdentifiantConnexion(identifiantConnexion)
                .orElseThrow(() -> new UsernameNotFoundException("Compte introuvable"));

        return User.builder()
                .username(compte.getId().toString())
                .password(compte.getMotDePasseHash())
                .authorities(List.of(new SimpleGrantedAuthority("ROLE_" + compte.getRole().name().toUpperCase())))
                .disabled(compte.getStatut() == StatutCompte.en_attente_consentement
                        || compte.getStatut() == StatutCompte.clos)
                .accountLocked(compte.getStatut() == StatutCompte.suspendu)
                .build();
    }
}
