package fr.brio.social;

/** Levée quand un compte écrit trop vite (limitation de débit préventive, ADR 0023). */
public class TropDeMessagesException extends RuntimeException {

    public TropDeMessagesException(String message) {
        super(message);
    }
}
