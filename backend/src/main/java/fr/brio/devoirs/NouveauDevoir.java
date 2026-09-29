package fr.brio.devoirs;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Les données pour créer un devoir (l'auteur vient de la session, à part). */
public record NouveauDevoir(
        UUID classeId,
        String titre,
        String consigne,
        String sourceType,
        String sourceRef,
        Integer sourceVersion,
        List<UUID> exerciceIds,
        Instant ouvreAt,
        Instant echeanceAt) {}
