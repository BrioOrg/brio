package fr.brio.exercices.web;

import fr.brio.exercices.CoursHorsPorteeException;
import fr.brio.exercices.ExerciceNotFoundException;
import fr.brio.exercices.NotAuthenticatedException;
import fr.brio.exercices.domain.InvalidAnswerException;
import fr.brio.exercices.infrastructure.UnsupportedExerciseTypeException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackages = "fr.brio.exercices.web")
class ExercicesExceptionHandler {

    @ExceptionHandler(ExerciceNotFoundException.class)
    ResponseEntity<Map<String, String>> handleNotFound(ExerciceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(CoursHorsPorteeException.class)
    ResponseEntity<Map<String, String>> handleHorsPortee(CoursHorsPorteeException ex) {
        // A stable code: the client says « cours » only for this refusal, never for another 403
        // (CSRF, password to change) on the same endpoint.
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("code", CODE_COURS_HORS_PORTEE, "error", ex.getMessage()));
    }

    static final String CODE_COURS_HORS_PORTEE = "cours_hors_portee";

    @ExceptionHandler(NotAuthenticatedException.class)
    ResponseEntity<Map<String, String>> handleNotAuthenticated(NotAuthenticatedException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler({InvalidAnswerException.class, UnsupportedExerciseTypeException.class})
    ResponseEntity<Map<String, String>> handleUnprocessable(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(Map.of("error", ex.getMessage()));
    }
}
