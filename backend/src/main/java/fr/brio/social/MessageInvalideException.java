package fr.brio.social;

/**
 * Levée quand un message est rejeté par la modération préventive : vide, trop long,
 * ou contenant un lien externe (ADR 0023).
 */
public class MessageInvalideException extends RuntimeException {

    public MessageInvalideException(String message) {
        super(message);
    }
}
