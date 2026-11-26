package fr.brio.exercices.rediges;

import org.springframework.http.HttpStatus;

final class ExerciceRedigeException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    ExerciceRedigeException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    HttpStatus status() {
        return status;
    }

    String code() {
        return code;
    }
}
