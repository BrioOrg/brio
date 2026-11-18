package fr.brio.identite.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.identite.ProtectionConnexionService;
import fr.brio.identite.ReinitialisationAccesService;
import fr.brio.identite.api.CompteInfo;
import fr.brio.identite.domain.Compte;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.core.context.SecurityContextHolder;
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
    private final ProtectionConnexionService protection;
    private final CompteInfoAssembler compteInfos;
    private final ObjectMapper json;

    LoginAuditHandler(CompteRepository comptes, SessionAuditRepository sessions,
                      ProtectionConnexionService protection, CompteInfoAssembler compteInfos,
                      ObjectMapper json) {
        this.comptes = comptes;
        this.sessions = sessions;
        this.protection = protection;
        this.compteInfos = compteInfos;
        this.json = json;
    }

    @Override
    @Transactional
    public void onAuthenticationSuccess(HttpServletRequest req, HttpServletResponse res,
                                        Authentication auth) throws IOException {
        UUID compteId = UUID.fromString(auth.getName()); // Authentication.getName() returns the principal username
        // The reset the typed password was checked against (CompteUserDetails). Any other
        // principal carries none, so it can never consume a provisional password.
        Instant reinitialiseLe = auth.getPrincipal() instanceof CompteUserDetails details
                ? details.getAccesReinitialiseLe() : null;
        // A provisional password opens exactly one session (ADR 0036 §3). Consumed by one
        // conditional UPDATE BEFORE the compte is loaded: two logins racing with it cannot both
        // win, and only the provisional password this login was checked against can be consumed.
        boolean provisoireConsomme = reinitialiseLe != null
                && comptes.consommerMotDePasseProvisoire(compteId, reinitialiseLe, Instant.now()) == 1;
        // LOCKED, not a plain read: a reset in progress holds this row. A plain read would see the
        // account as it was before the reset, and this transaction would then write that old state
        // back over it (old password, no change pending) — undoing the reset. Locked, the login
        // waits for the reset to commit, sees the change pending, and is refused below (ADR 0036 §3).
        Compte compte = comptes.verrouiller(compteId)
                .orElseThrow(() -> new IllegalStateException("Compte introuvable après authentification"));
        if (compte.isDoitChangerMotDePasse() && !provisoireConsomme) {
            // While a change is pending only the provisional password opens a session. Either it
            // was just used by a concurrent login, or a reset happened after this login loaded the
            // account: the password that matched was the old one (or an older provisional one),
            // which no longer opens anything — and must not use up the new one (ADR 0036 §3).
            // Undo this session and answer exactly like a wrong password, with the same count.
            refuser(req, res);
            return;
        }

        if (provisoireConsomme) {
            // The one session the provisional password opened: the only one allowed to choose the
            // new password (ReinitialisationAccesService#changerMotDePasse).
            req.getSession().setAttribute(
                    ReinitialisationAccesService.ATTRIBUT_SESSION_REINITIALISATION, reinitialiseLe);
        }

        compte.marquerDernierAcces();

        // A clean login clears any accumulated failures for the identifiant that was typed.
        protection.reinitialiser(req.getParameter("identifiant"));

        int maxAge = req.getSession().getMaxInactiveInterval();
        Instant expireAt = Instant.now().plusSeconds(maxAge > 0 ? maxAge : 1800);
        sessions.save(SessionAudit.of(compteId, expireAt, truncateIp(req.getRemoteAddr()),
                hashUserAgent(req.getHeader("User-Agent"))));

        CompteInfo info = compteInfos.pour(compte);

        res.setStatus(HttpServletResponse.SC_OK);
        res.setContentType("application/json;charset=UTF-8");
        json.writeValue(res.getWriter(), info);
    }

    private void refuser(HttpServletRequest req, HttpServletResponse res) throws IOException {
        SecurityContextHolder.clearContext();
        HttpSession session = req.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        protection.enregistrerEchec(req.getParameter("identifiant"));
        res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        res.setContentType("application/json;charset=UTF-8");
        res.getWriter().write(ProtectionConnexionService.CORPS_ECHEC_CONNEXION);
    }

    static String truncateIp(String ip) {
        return AdresseIp.tronquer(ip);
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
