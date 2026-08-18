package fr.brio.exercices.domain;

public class InvalidAnswerException extends RuntimeException {
    public InvalidAnswerException(String message) {
        super(message);
    }
}
