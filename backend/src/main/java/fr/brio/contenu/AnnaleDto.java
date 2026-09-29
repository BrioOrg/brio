package fr.brio.contenu;

/**
 * Une annale pour la liste F7 (ADR 0026). {@code id} = slug du chapitre → le sujet se lit via
 * l'endpoint chapitre par triplet existant ({@code niveau}/{@code matiere}/{@code id}).
 */
public record AnnaleDto(
        String id,
        String titre,
        String examen,
        String session,
        int annee,
        String centre,
        String niveau,
        String matiere,
        Integer dureeMinutes) {}
