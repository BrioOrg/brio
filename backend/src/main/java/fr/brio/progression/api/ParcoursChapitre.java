package fr.brio.progression.api;

/**
 * A student's state for one chapter of a track: its position, path state, and
 * completion percentage (clamped to 100 once the chapter is done). Published
 * projection consumed by the atlas (#79) and the completion label (#82); it
 * carries no chapter display data — the client joins it to the catalogue by id.
 */
public record ParcoursChapitre(
        String chapitreId,
        int ordre,
        EtatParcours etat,
        int pourcentage) {}
