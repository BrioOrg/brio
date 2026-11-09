package fr.brio.system.web;

import fr.brio.identite.ProtectionConnexionService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Guards {@code POST /api/sessions} before credentials are checked (ADR 0017 §7). Rejects, with
 * the same JSON shape as the rest of the API, an IP that has exceeded the per-minute attempt cap
 * (429) or an identifiant that is currently locked out (423). Runs before the authentication
 * filter so a locked or throttled attempt never reaches password validation.
 *
 * Not a @Component — created directly in SecurityConfig to avoid Spring Boot's automatic
 * servlet-filter registration (which would run it twice per request), as StatutCheckFilter does.
 */
class ProtectionConnexionFilter extends OncePerRequestFilter {

    private final ProtectionConnexionService protection;

    ProtectionConnexionFilter(ProtectionConnexionService protection) {
        this.protection = protection;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if ("POST".equals(request.getMethod()) && "/api/sessions".equals(request.getRequestURI())) {
            if (protection.tropDeTentatives(request.getRemoteAddr())) {
                refuser(response, 429 /* Too Many Requests */,
                        "Trop de tentatives de connexion. Réessaie dans une minute.");
                return;
            }
            if (protection.estVerrouille(request.getParameter("identifiant"))) {
                refuser(response, 423 /* Locked */,
                        "Compte temporairement bloqué après plusieurs échecs. Réessaie dans un quart d'heure.");
                return;
            }
        }
        chain.doFilter(request, response);
    }

    private static void refuser(HttpServletResponse response, int statut, String message) throws IOException {
        response.setStatus(statut);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"error\":\"" + message + "\"}");
    }
}
