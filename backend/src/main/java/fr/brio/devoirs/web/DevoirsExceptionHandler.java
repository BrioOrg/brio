package fr.brio.devoirs.web;

import fr.brio.devoirs.DevoirNotFoundException;
import fr.brio.devoirs.PasEnseignantDeLaClasseException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackages = "fr.brio.devoirs.web")
class DevoirsExceptionHandler {

    @ExceptionHandler(DevoirNotFoundException.class)
    ResponseEntity<Map<String, String>> handleNotFound(DevoirNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(PasEnseignantDeLaClasseException.class)
    ResponseEntity<Map<String, String>> handleForbidden(PasEnseignantDeLaClasseException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
    }
}
