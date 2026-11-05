package fr.brio.progression.infrastructure;

import java.time.Instant;

/** When a student last submitted on a competence. */
public record DernierTravail(String competenceCode, Instant dernier) {}
