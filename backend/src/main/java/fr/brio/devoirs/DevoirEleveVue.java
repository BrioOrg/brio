package fr.brio.devoirs;

import java.time.Instant;
import java.util.UUID;

/** Un devoir tel que l'élève le voit dans « mes devoirs » : l'essentiel + le statut de son rendu. */
public record DevoirEleveVue(
        UUID id,
        String titre,
        String consigne,
        Instant echeanceAt,
        int nombreExercices,
        String statutRendu) {}
