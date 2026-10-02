package fr.brio.contenu.web;

import fr.brio.contenu.CoursAccesRefuseException;
import fr.brio.contenu.CoursIntrouvableException;
import fr.brio.contenu.InvalidContentException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackages = "fr.brio.contenu.web")
class ContenuExceptionHandler {

    /**
     * A structured problem: {@code detail} keeps the technical message for logs, and
     * {@code violations} locates each failure (code, section, block, field) so the editor can
     * translate it and lead the teacher to the block — never shown raw to the user.
     */
    @ExceptionHandler(InvalidContentException.class)
    ProblemDetail handleInvalidContent(InvalidContentException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage());
        problem.setTitle("Contenu non publiable");
        problem.setProperty("violations", ex.violations());
        return problem;
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
