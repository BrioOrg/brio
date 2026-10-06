package fr.brio.social;

/** Levée quand un compte tente de modérer une classe dont il n'est pas l'enseignant. */
public class PasModerateurException extends RuntimeException {

    public PasModerateurException(String message) {
        super(message);
    }
}
