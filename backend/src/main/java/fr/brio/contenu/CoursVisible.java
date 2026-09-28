package fr.brio.contenu;

import java.time.Instant;
import java.util.UUID;

/**
 * A published teacher course as it appears in a student's list of courses: enough to label
 * and link it, never its content. {@code auteurId} is resolved to a display name by the
 * caller (identite owns names — ADR 0007). {@code publieAt} is when the served version was
 * published.
 */
public record CoursVisible(
        UUID id,
        String titre,
        String niveauCode,
        String matiereCode,
        UUID auteurId,
        Instant publieAt) {}
