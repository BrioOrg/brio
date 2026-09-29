package fr.brio.devoirs;

import java.time.Instant;
import java.util.UUID;

/** Résumé d'un devoir dans la liste des devoirs d'une classe (vue enseignant). */
public record DevoirClasseVue(
    UUID id,
    String titre,
    Instant ouvreAt,
    Instant echeanceAt,
    String statut,
    int nombreExercices) {}
