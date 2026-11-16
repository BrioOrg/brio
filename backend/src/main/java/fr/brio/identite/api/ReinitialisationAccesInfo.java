package fr.brio.identite.api;

import java.time.Instant;

/**
 * Returned once, to the teacher who reset a student's access (ADR 0036 §2): the student's login
 * identifier and the provisional password, in clear, with its expiry. No endpoint can read the
 * provisional password back — if it is lost, the teacher resets again.
 */
public record ReinitialisationAccesInfo(
        String identifiantConnexion,
        String motDePasseProvisoire,
        Instant expireLe
) {}
