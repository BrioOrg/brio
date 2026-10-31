package fr.brio.progression.api;

import java.time.Instant;

/**
 * The chapter a student last read a section of without finishing it (#323).
 * {@code chapitreId} is the chapter document's id, which is also its catalogue slug:
 * with the niveau and matière codes it gives the chapter's URL.
 */
public record ChapitreAReprendre(
        String chapitreId,
        String titre,
        String niveauCode,
        String matiereCode,
        int sectionsLues,
        int sectionsTotal,
        Instant derniereActivite) {}
