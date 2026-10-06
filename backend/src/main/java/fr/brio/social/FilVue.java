package fr.brio.social;

import java.time.Instant;
import java.util.UUID;

/** Résumé d'un fil pour la liste d'entraide d'un chapitre ou d'un exercice. */
public record FilVue(
        UUID id,
        String portee,
        String porteeRef,
        String titre,
        UUID auteurId,
        String auteurNom,
        String statut,
        boolean resolu,
        int nbReponses,
        Instant createdAt) {}
