package fr.brio.devoirs;

import java.time.Instant;

/**
 * Le contrôle en cours d'un élève (mode contrôle, ADR 0025), pour afficher un bandeau et verrouiller
 * le tuteur côté interface. {@code enControle} faux et champs nuls s'il n'y a pas de contrôle ouvert.
 */
public record ControleActif(boolean enControle, String titre, Instant echeanceAt) {}
