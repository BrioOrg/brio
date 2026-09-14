package fr.brio.identite.api;

import java.util.UUID;

/**
 * Returned exactly once when an élève joins via class code.
 * Contains identifiantConnexion so the student can note it for future logins.
 * This is the only response type where identifiantConnexion is disclosed (ADR 0016 §4 and ADR 0018 §5).
 * All other response types (CompteInfo, etc.) must not include it.
 */
public record EleveInscritInfo(
        UUID id,
        String identifiantConnexion,
        String nomAffiche,
        String classeLibelle
) {}
