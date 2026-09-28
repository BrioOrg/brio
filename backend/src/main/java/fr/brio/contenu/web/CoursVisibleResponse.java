package fr.brio.contenu.web;

import fr.brio.contenu.CoursVisible;
import java.time.Instant;
import java.util.UUID;

/**
 * One entry of a student's course list. {@code enseignant} is the author's display name, or
 * absent when identite has none — the client then shows no name rather than a placeholder.
 */
record CoursVisibleResponse(
        UUID id,
        String titre,
        String niveauCode,
        String matiereCode,
        String enseignant,
        Instant publieAt) {

    static CoursVisibleResponse from(CoursVisible c, String enseignant) {
        return new CoursVisibleResponse(
                c.id(), c.titre(), c.niveauCode(), c.matiereCode(), enseignant, c.publieAt());
    }
}
