package fr.brio.devoirs;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Le détail complet d'un devoir. */
public record DevoirDetail(
        UUID id,
        UUID classeId,
        String titre,
        String consigne,
        String type,
        String sourceType,
        String sourceRef,
        List<UUID> exerciceIds,
        Instant ouvreAt,
        Instant echeanceAt,
        Instant correctionVisibleAt,
        String statut) {}
