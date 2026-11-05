package fr.brio.social;

/** Question, réponse ou commentaire inexistant ou supprimé. */
public class MessageCommunauteNotFoundException extends RuntimeException {

    public MessageCommunauteNotFoundException() {
        super("Ce message n'existe pas ou n'est plus disponible.");
    }
}
