package fr.brio.social;

/**
 * Levée quand un compte tente une action de messagerie qu'il n'a pas le droit de faire :
 * écrire dans un salon dont il n'est pas membre, ou créer un salon pour une classe
 * qu'il n'enseigne pas.
 */
public class AccesMessagerieRefuseException extends RuntimeException {

    public AccesMessagerieRefuseException(String message) {
        super(message);
    }
}
