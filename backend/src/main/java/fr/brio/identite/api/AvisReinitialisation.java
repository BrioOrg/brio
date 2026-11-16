package fr.brio.identite.api;

import java.time.Instant;

/**
 * Tells a student their access was reset (ADR 0036 §8): when, and by which kind of adult
 * ({@code enseignant} or {@code admin_brio}). Shown once the student has chosen their own
 * password, so that a student who did not choose it themselves can warn their teacher.
 */
public record AvisReinitialisation(Instant le, String par) {}
