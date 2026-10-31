package fr.brio.identite.api;

/**
 * A student's out-of-class identity (#325): pseudonym and level, the same level
 * {@link CompteInfo} shows. Never carries a display name. {@code niveau} is null for a student
 * in no class who declared none.
 */
public record ProfilEleve(String pseudonyme, String niveau) {}
