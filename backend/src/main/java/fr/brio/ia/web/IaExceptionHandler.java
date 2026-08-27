package fr.brio.ia.web;

import fr.brio.ia.domain.ChapitreNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackages = "fr.brio.ia.web")
class IaExceptionHandler {

    @ExceptionHandler(ChapitreNotFoundException.class)
    ProblemDetail handleChapitreNotFound(ChapitreNotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    }
}
