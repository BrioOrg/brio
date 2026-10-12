package fr.brio.social;

import java.util.UUID;

/** Levée quand un message de salon est introuvable. */
public class SalonMessageNotFoundException extends RuntimeException {

    public SalonMessageNotFoundException(UUID messageId) {
        super("Message de salon introuvable : " + messageId);
    }
}
