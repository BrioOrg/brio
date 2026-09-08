package fr.brio.identite.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.identite.api.CompteInfo;
import fr.brio.identite.domain.Compte;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

@Component
class LoginAuditHandler implements AuthenticationSuccessHandler {

    private final CompteRepository comptes;
    private final SessionAuditRepository sessions;
    private final ObjectMapper json;

    LoginAuditHandler(CompteRepository comptes, SessionAuditRepository sessions, ObjectMapper json) {
        this.comptes = comptes;
        this.sessions = sessions;
        this.json = json;
    }

    @Override
    @Transactional
    public void onAuthenticationSuccess(HttpServletRequest req, HttpServletResponse res,
                                        Authentication auth) throws IOException {
        UUID compteId = UUID.fromString(auth.getName()); // Authentication.getName() returns the principal username
        Compte compte = comptes.findById(compteId)
                .orElseThrow(() -> new IllegalStateException("Compte introuvable après authentification"));

        compte.marquerDernierAcces();

        int maxAge = req.getSession().getMaxInactiveInterval();
        Instant expireAt = Instant.now().plusSeconds(maxAge > 0 ? maxAge : 1800);
        sessions.save(SessionAudit.of(compteId, expireAt, truncateIp(req.getRemoteAddr()),
                hashUserAgent(req.getHeader("User-Agent"))));

        CompteInfo info = new CompteInfo(
                compte.getId(),
                compte.getRole().name(),
                compte.getStatut().name(),
                compte.getNom(),
                compte.getEmail());

        res.setStatus(HttpServletResponse.SC_OK);
        res.setContentType("application/json;charset=UTF-8");
        json.writeValue(res.getWriter(), info);
    }

    static String truncateIp(String ip) {
        if (ip == null) return null;
        if (ip.contains(":")) {
            // IPv6: zero the last 64 bits (last 4 groups in expanded form)
            String[] parts = ip.split(":", -1);
            if (parts.length == 8) {
                parts[4] = "0"; parts[5] = "0"; parts[6] = "0"; parts[7] = "0";
                return String.join(":", parts);
            }
            return ip; // abbreviated form — store as-is rather than guess
        }
        // IPv4: remove last octet
        int last = ip.lastIndexOf('.');
        return last >= 0 ? ip.substring(0, last) + ".0" : ip;
    }

    static String hashUserAgent(String ua) {
        if (ua == null) return null;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(ua.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
