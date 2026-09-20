package fr.brio.progression.api;

/**
 * Published mastery of one competence for a student (ADR 0022 §6). {@code niveau} is
 * 0–4, or {@code null} while the sample is too small to report an honest level — the
 * client shows "en cours d'évaluation" rather than a fabricated value. {@code echantillon}
 * is the number of first attempts the level is based on (0 when none yet).
 */
public record MaitriseInfo(String competenceCode, Integer niveau, int echantillon) {}
