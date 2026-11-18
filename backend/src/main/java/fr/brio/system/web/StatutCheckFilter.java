package fr.brio.system.web;

import fr.brio.identite.CompteService;
import fr.brio.identite.api.EtatAcces;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Re-checks compte.statut on every authenticated request, and holds a session whose password
 * must be changed (ADR 0036 §5) to the change itself.
 * This closes the gap where a consent revocation would otherwise leave an existing
 * session valid until the cookie expires. Spring Security's UserDetails are cached
 * in the session and not re-loaded after login, so this filter is the enforcement
 * point for the statut invariant (ADR 0016 §5 / ADR 0017 §7).
 *
 * Not a @Component — created directly in SecurityConfig to avoid Spring Boot's
 * automatic servlet-filter registration (which would run it twice per request).
 */
class StatutCheckFilter extends OncePerRequestFilter {

    private final CompteService compteService;

    StatutCheckFilter(CompteService compteService) {
        this.compteService = compteService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof UserDetails) {
            try {
                UUID compteId = UUID.fromString(auth.getName());
                EtatAcces etat = compteService.etatAcces(compteId);
                if (etat == EtatAcces.INACTIF) {
                    SecurityContextHolder.clearContext();
                    response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
                    return;
                }
                // After a teacher-led reset the student must choose their own password before
                // anything else (ADR 0036 §5) — enforced here, not only by the web's redirect.
                if (etat == EtatAcces.MOT_DE_PASSE_A_CHANGER && !permisAvantChangement(request)) {
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("application/json;charset=UTF-8");
                    response.getWriter().write(
                            "{\"error\":\"Choisis ton nouveau mot de passe avant de continuer.\"}");
                    return;
                }
            } catch (IllegalArgumentException ignored) {
                // Principal is not a UUID — not a Brio session (e.g. Basic Auth in local), skip.
            }
        }
        chain.doFilter(request, response);
    }

    /** The only calls a session may make while its password change is pending (logout is handled earlier). */
    private static boolean permisAvantChangement(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String methode = request.getMethod();
        return ("GET".equals(methode) && "/api/moi".equals(uri))
                || ("POST".equals(methode) && "/api/moi/mot-de-passe".equals(uri));
    }
}
