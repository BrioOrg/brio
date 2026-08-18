package fr.brio.exercices;

public class NotAuthenticatedException extends RuntimeException {
    public NotAuthenticatedException() {
        super("Authentication required");
    }
}
