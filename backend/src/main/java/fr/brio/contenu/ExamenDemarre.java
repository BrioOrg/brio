package fr.brio.contenu;

import java.time.Instant;
import java.util.UUID;

/** Résultat du démarrage d'un examen d'annale (F7, ADR 0027). */
public record ExamenDemarre(UUID sessionId, Instant endsAt) {}
