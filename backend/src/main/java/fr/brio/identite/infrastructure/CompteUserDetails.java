package fr.brio.identite.infrastructure;

import java.time.Instant;
import java.util.Collection;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.User;

/**
 * The principal of a login, plus the access-reset state the password was checked against
 * (ADR 0036 §3). Spring compares the typed password with the hash read here, then the success
 * handler consumes the provisional password: between the two, a teacher may have issued a new
 * one. {@link #accesReinitialiseLe} lets the handler consume only the provisional password that
 * was actually checked — never one issued after the account was loaded.
 *
 * <p>Survives {@code eraseCredentials()} (only the password is erased) and Java serialisation
 * into the session store (ADR 0034).
 */
final class CompteUserDetails extends User {

    private static final long serialVersionUID = 1L;

    /** The account's last reset when it was loaded for this login; null if never reset. */
    private final Instant accesReinitialiseLe;

    CompteUserDetails(String username, String password, boolean enabled, boolean credentialsNonExpired,
                      boolean accountNonLocked, Collection<? extends GrantedAuthority> authorities,
                      Instant accesReinitialiseLe) {
        super(username, password, enabled, true, credentialsNonExpired, accountNonLocked, authorities);
        this.accesReinitialiseLe = accesReinitialiseLe;
    }

    // User's equals/hashCode (username only) are kept on purpose: the same account is the same
    // principal for the session registry, whatever its reset state.
    Instant getAccesReinitialiseLe() {
        return accesReinitialiseLe;
    }
}
