package fr.brio.social;

/**
 * Comment un élève apparaît dans la Communauté : « Renard-Turquoise · 3e » (ADR 0035 §8).
 *
 * <p>Ni nom affiché, ni identifiant de compte : l'entraide de classe renvoie l'identifiant avec le
 * nom affiché, si bien qu'un camarade pourrait relier les deux et lever le pseudonyme (#325).
 * Un compte qu'on ne retrouve plus apparaît sous un libellé générique, sans niveau.
 */
public record AuteurCommunaute(String pseudonyme, String niveau) {}
