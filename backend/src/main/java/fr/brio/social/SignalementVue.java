package fr.brio.social;

import java.time.Instant;
import java.util.UUID;

/** Un signalement en attente dans la file de modération du prof. */
public record SignalementVue(
        UUID id,
        UUID messageId,
        UUID filId,
        String filTitre,
        UUID auteurMessageId,
        String auteurMessageNom,
        String extraitMessage,
        UUID signalePar,
        String motif,
        Instant createdAt) {}
