package fr.brio.contenu.api;

import java.time.Instant;
import java.util.UUID;

/**
 * Published when a student marks a lesson section as read. Emitted by contenu
 * (owner of section structure) from the light "section lue" endpoint; the student
 * id comes from the session, and the section is validated to belong to the chapter
 * before the event is published.
 *
 * progression consumes this to record the read (idempotently), award section XP,
 * and re-evaluate chapter completion — it never calls back into contenu (ADR 0022).
 */
public record SectionTerminee(
        UUID eleveId,
        String chapitreId,
        String sectionId,
        Instant survenuLe) {}
