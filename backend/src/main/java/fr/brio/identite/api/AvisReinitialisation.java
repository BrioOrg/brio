package fr.brio.identite.api;

import java.time.Instant;

/**
 * Tells a student their access was reset (ADR 0036 §8): when, and by which kind of adult. Shown
 * once the student has chosen their own password, so that a student who did not choose it
 * themselves can warn an adult.
 */
public record AvisReinitialisation(Instant le, ReinitialisePar par) {}
