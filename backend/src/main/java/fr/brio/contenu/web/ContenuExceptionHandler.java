package fr.brio.contenu.web;

import fr.brio.contenu.CoursAccesRefuseException;
import fr.brio.contenu.CoursIntrouvableException;
import fr.brio.contenu.InvalidContentException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackages = "fr.brio.contenu.web")
class ContenuExceptionHandler {

    @ExceptionHandler(InvalidContentException.class)
    ResponseEntity<Map<String, String>> handleInvalidContent(InvalidContentException ex) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(CoursIntrouvableException.class)
    ResponseEntity<Void> handleCoursIntrouvable(CoursIntrouvableException ex) {
        return ResponseEntity.notFound().build();
    }

    @ExceptionHandler(CoursAccesRefuseException.class)
    ResponseEntity<Void> handleCoursAccesRefuse(CoursAccesRefuseException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
}
