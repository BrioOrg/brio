package fr.brio.contenu.api;

/**
 * The lesson section that teaches a competency: where a student should go to review it.
 *
 * @param niveauCode level of the chapter (e.g. "6e")
 * @param matiereCode subject of the chapter
 * @param chapitreId chapter id, which is also its URL slug
 * @param sectionId id of the first lesson section carrying the competency
 * @param sectionTitre title of that section
 */
public record LeconCompetence(
        String niveauCode, String matiereCode, String chapitreId, String sectionId, String sectionTitre) {}
