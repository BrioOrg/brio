package fr.brio.contenu.api;

/**
 * A competency's human label, for showing a student's mastery by name (#324). Unlike
 * {@link CompetenceDto} it covers deprecated codes too: a student may have worked on one before
 * it was superseded, and that history still needs a name.
 */
public record CompetenceLibelle(String code, String intitule) {}
