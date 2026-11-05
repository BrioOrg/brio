package fr.brio.social;

/** Levée quand on retient une réponse sur une question déjà résolue par une autre. */
public class QuestionDejaResolueException extends RuntimeException {

    public QuestionDejaResolueException() {
        super("Une autre réponse a déjà résolu cette question.");
    }
}
