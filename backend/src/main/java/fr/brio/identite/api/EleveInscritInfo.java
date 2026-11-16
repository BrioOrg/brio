package fr.brio.identite.api;

import java.util.UUID;

/**
 * Returned exactly once when an élève joins via class code.
 * Contains identifiantConnexion so the student can note it for future logins.
 * With ReinitialisationAccesInfo (returned once to the teacher who resets a student's access,
 * ADR 0036), the only response types where identifiantConnexion is disclosed (ADR 0016 §4 and
 * ADR 0018 §5). All other response types (CompteInfo, etc.) must not include it.
 */
public record EleveInscritInfo(
        UUID id,
        String identifiantConnexion,
        String nomAffiche,
        String classeLibelle
) {}
