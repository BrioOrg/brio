package fr.brio.social;

import java.time.Instant;
import java.util.UUID;

/**
 * Un signalement en attente dans la file de modération du prof. {@code classeId} est la classe
 * du fil : c'est dans cette classe qu'une sanction s'applique.
 */
public record SignalementVue(
        UUID id,
        UUID messageId,
        UUID filId,
        UUID classeId,
        String filTitre,
        UUID auteurMessageId,
        String auteurMessageNom,
        String extraitMessage,
        UUID signalePar,
        String motif,
        Instant createdAt) {}
