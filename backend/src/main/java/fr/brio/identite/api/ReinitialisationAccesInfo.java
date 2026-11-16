package fr.brio.identite.api;

import java.time.Instant;

/**
 * Returned once, to the adult who reset a student's access (ADR 0036 §2): the student's login
 * identifier and the provisional password, in clear, with its expiry. No endpoint can read the
 * provisional password back — if it is lost, the adult resets again.
 */
public record ReinitialisationAccesInfo(
        String identifiantConnexion,
        String motDePasseProvisoire,
        Instant expireLe
) {
    /** Never prints the password: a record's default toString would put it in any log line. */
    @Override
    public String toString() {
        return "ReinitialisationAccesInfo[identifiantConnexion=" + identifiantConnexion
                + ", motDePasseProvisoire=***, expireLe=" + expireLe + "]";
    }
}
