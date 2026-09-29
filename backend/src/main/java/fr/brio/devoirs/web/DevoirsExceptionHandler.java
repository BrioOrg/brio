package fr.brio.devoirs.web;

import fr.brio.devoirs.AccesPieceRefuseException;
import fr.brio.devoirs.DevoirNotFoundException;
import fr.brio.devoirs.PasEnseignantDeLaClasseException;
import fr.brio.devoirs.PieceInvalideException;
import fr.brio.devoirs.PieceNotFoundException;
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

    @ExceptionHandler({PasEnseignantDeLaClasseException.class, AccesPieceRefuseException.class})
    ResponseEntity<Map<String, String>> handleForbidden(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(PieceNotFoundException.class)
    ResponseEntity<Map<String, String>> handlePieceNotFound(PieceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(PieceInvalideException.class)
    ResponseEntity<Map<String, String>> handlePieceInvalide(PieceInvalideException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
    }
}
