package fr.brio.social;

import java.util.UUID;

/** Levée quand un message est introuvable (ou n'appartient pas au fil visé). */
public class MessageNotFoundException extends RuntimeException {

    public MessageNotFoundException(UUID messageId) {
        super("Message introuvable : " + messageId);
    }
}
