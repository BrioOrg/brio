package fr.brio.identite;

import fr.brio.identite.infrastructure.AdresseIp;
import fr.brio.identite.infrastructure.DebitConnexionRepository;
import fr.brio.identite.infrastructure.EchecConnexionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

/**
 * Server-side protection of the login endpoint (ADR 0017 §7), stored in Postgres (not Redis,
 * which is absent from the deployed stack — ADR 0034). Two independent guards:
 *
 * <ul>
 *   <li><b>Progressive lockout</b> per identifiant: after {@code maxEchecs} failures the
 *       identifiant is locked for {@code dureeVerrouMinutes}. A collégien's weak password is
 *       protected by making guessing slow, rather than by complexity rules they would write down.</li>
 *   <li><b>Rate limiting</b> per truncated IP: at most {@code maxParMinute} attempts per minute,
 *       regardless of which account they target, to blunt a bot spraying the endpoint.</li>
 * </ul>
 */
@Service
public class ProtectionConnexionService {

    private final EchecConnexionRepository echecs;
    private final DebitConnexionRepository debits;
    private final int maxEchecs;
    private final int dureeVerrouMinutes;
    private final int maxParMinute;

    ProtectionConnexionService(EchecConnexionRepository echecs,
                               DebitConnexionRepository debits,
                               @Value("${brio.connexion.max-echecs:5}") int maxEchecs,
                               @Value("${brio.connexion.duree-verrou-minutes:15}") int dureeVerrouMinutes,
                               @Value("${brio.connexion.max-par-minute:20}") int maxParMinute) {
        this.echecs = echecs;
        this.debits = debits;
        this.maxEchecs = maxEchecs;
        this.dureeVerrouMinutes = dureeVerrouMinutes;
        this.maxParMinute = maxParMinute;
    }

    /**
     * Counts this attempt from the given (raw) client IP and tells whether the per-minute cap
     * is now exceeded. Call once per login attempt, before authenticating.
     */
    @Transactional
    public boolean tropDeTentatives(String ipClient) {
        String ip = AdresseIp.tronquer(ipClient);
        if (ip == null || ip.isBlank()) return false;
        debits.enregistrerTentative(ip);
        Integer n = debits.compteActuel(ip);
        return n != null && n > maxParMinute;
    }

    /** True while the identifiant is under an active lock. */
    @Transactional(readOnly = true)
    public boolean estVerrouille(String identifiant) {
        String id = normaliser(identifiant);
        return id != null && echecs.estVerrouille(id);
    }

    /** Records a failed attempt for the identifiant and locks it if the threshold is reached. */
    @Transactional
    public void enregistrerEchec(String identifiant) {
        String id = normaliser(identifiant);
        if (id == null) return;
        echecs.enregistrerEchec(id);
        echecs.appliquerVerrou(id, dureeVerrouMinutes, maxEchecs);
    }

    /** Clears the failure/lock state for the identifiant (called on a successful login). */
    @Transactional
    public void reinitialiser(String identifiant) {
        String id = normaliser(identifiant);
        if (id != null) echecs.supprimer(id);
    }

    // Key lockout on a stable form of what the user typed, so trivial case/space variations
    // do not sidestep the counter. The per-IP limit covers variation beyond that.
    private static String normaliser(String identifiant) {
        if (identifiant == null) return null;
        String t = identifiant.trim().toLowerCase(Locale.ROOT);
        return t.isEmpty() ? null : t;
    }
}
