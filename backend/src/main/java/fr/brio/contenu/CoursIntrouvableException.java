package fr.brio.contenu;

import java.util.UUID;

/** A course was referenced by an ID that does not exist. The web tranche maps this to 404. */
public class CoursIntrouvableException extends RuntimeException {
    public CoursIntrouvableException(UUID coursId) {
        super("Unknown course: " + coursId);
    }
}
