package fr.brio.contenu;

import java.time.Instant;

/**
 * L'examen d'annale en cours d'un élève (F7, ADR 0027), pour afficher le chrono, permettre de rendre,
 * et verrouiller le tuteur côté interface. {@code enExamen} faux et champs nuls s'il n'y en a pas.
 */
public record ExamenActif(
    boolean enExamen, String sessionId, String annaleId, String titre, Instant endsAt) {}
