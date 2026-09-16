package fr.brio.identite.api;

import java.util.UUID;

/**
 * Returned once when a path B élève registers. Contains identifiantConnexion
 * so the student can note it before logging in after parental consent.
 * This is one of two response types allowed to disclose identifiantConnexion
 * (the other being EleveInscritInfo for path A — see ADR 0016 §4 and ADR 0018 §5).
 */
public record InscriptionEleveEnAttenteInfo(
        UUID id,
        String identifiantConnexion,
        String statut
) {}
