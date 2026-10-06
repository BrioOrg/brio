package fr.brio.social;

/**
 * Levée quand un compte tente une action d'entraide qu'il n'a pas le droit de faire :
 * écrire dans une classe dont il n'est pas membre, ou agir sur un fil qui n'est pas le sien.
 */
public class AccesEntraideRefuseException extends RuntimeException {

    public AccesEntraideRefuseException(String message) {
        super(message);
    }
}
