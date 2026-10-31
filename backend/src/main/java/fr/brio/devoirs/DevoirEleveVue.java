package fr.brio.devoirs;

import java.time.Instant;
import java.util.UUID;

/**
 * Un devoir tel que l'élève le voit dans « mes devoirs » : l'essentiel + le statut de son rendu.
 * {@code enseignant} est absent quand identite n'a pas de nom pour l'auteur ; {@code sourceRef} est
 * l'id du cours ou le slug du chapitre selon {@code sourceType}.
 */
public record DevoirEleveVue(
        UUID id,
        UUID classeId,
        String titre,
        String consigne,
        String enseignant,
        String sourceType,
        String sourceRef,
        Instant echeanceAt,
        int nombreExercices,
        String statutRendu,
        boolean corrige) {}
