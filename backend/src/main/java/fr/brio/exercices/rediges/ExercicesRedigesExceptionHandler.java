package fr.brio.exercices.rediges;

import org.springframework.http.CacheControl;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = {ExercicesRedigesController.class, ProfExercicesRedigesController.class})
class ExercicesRedigesExceptionHandler {
    @ExceptionHandler(ExerciceRedigeException.class)
    ResponseEntity<ProblemDetail> handleExerciceRedige(ExerciceRedigeException exception) {
        var problem = ProblemDetail.forStatusAndDetail(exception.status(), exception.getMessage());
        problem.setProperty("code", exception.code());
        return ResponseEntity.status(exception.status()).cacheControl(CacheControl.noStore()).body(problem);
    }
}
