package fr.brio.progression.api;

import java.time.Instant;
import java.util.UUID;

/**
 * A teacher course the student last read without finishing it (ADR 0050 §5). Only proposed while
 * the student can still open it; {@code titre} is its published version's title, read at that
 * moment. No niveau or matière: the link is {@code /cours/{coursId}}.
 */
public record CoursAReprendre(
        UUID coursId,
        String titre,
        int sectionsLues,
        int sectionsTotal,
        Instant derniereActivite) implements ContenuAReprendre {}
