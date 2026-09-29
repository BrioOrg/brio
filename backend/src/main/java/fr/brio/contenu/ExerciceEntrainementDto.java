package fr.brio.contenu;

import java.util.UUID;

/**
 * Un exercice d'annale proposé en entraînement ciblé par compétence (F7, ADR 0026). La correction
 * n'est jamais incluse ; la soumission passe par le flux {@code exercices} habituel.
 */
public record ExerciceEntrainementDto(
        UUID exerciceId,
        String prompt,
        String exerciseType,
        String annaleId,
        String annaleTitre) {}
