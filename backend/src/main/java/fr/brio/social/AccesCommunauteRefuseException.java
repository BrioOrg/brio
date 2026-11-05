package fr.brio.social;

/** Levée quand un compte tente, dans la Communauté, une action qu'il n'a pas le droit de faire. */
public class AccesCommunauteRefuseException extends RuntimeException {

    public AccesCommunauteRefuseException(String message) {
        super(message);
    }
}
