package fr.brio.contenu;

import java.util.UUID;

/**
 * A teacher tried to edit or publish a course they do not author. The web tranche maps this
 * to 403. Deliberately distinct from {@link CoursIntrouvableException} (404): the course
 * exists, the caller just may not touch it.
 */
public class CoursAccesRefuseException extends RuntimeException {
    public CoursAccesRefuseException(UUID coursId, UUID auteurId) {
        super("Account " + auteurId + " may not edit course " + coursId);
    }
}
