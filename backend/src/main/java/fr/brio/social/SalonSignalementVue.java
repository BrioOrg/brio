package fr.brio.social;

import java.time.Instant;
import java.util.UUID;

/** Un signalement de salon en attente, dans la file de modération du prof. */
public record SalonSignalementVue(
        UUID id,
        UUID messageId,
        UUID salonId,
        String salonTitre,
        UUID auteurMessageId,
        String auteurMessageNom,
        String extraitMessage,
        UUID signalePar,
        String motif,
        Instant createdAt) {}
