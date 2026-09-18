package fr.brio.progression.api;

/**
 * Published projection of a student's progression, safe to return to the client
 * and to other modules. XP total and level only — no per-source detail.
 */
public record ProgressionInfo(int xpTotal, int niveau) {}
