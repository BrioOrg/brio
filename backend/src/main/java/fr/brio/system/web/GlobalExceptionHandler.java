package fr.brio.system.web;

import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Single source of error responses for the API, in the shape {@code { "error": "…" }}.
 *
 * <p>Extends {@link ResponseEntityExceptionHandler} so every standard Spring MVC failure is
 * answered with its own status instead of a blanket 500 (#342): a malformed path id or a bad
 * query parameter is 400, an unsupported method 405, an unsupported content type 415, and so on.
 * {@link #handleExceptionInternal} rewrites the framework's RFC 7807 body into our flat shape.
 * Only genuinely unexpected exceptions reach the catch-all below and become 500.
 */
@RestControllerAdvice
class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    /** Re-clothes every framework exception handled by the superclass in our {@code { "error" }} shape. */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception ex, Object body, HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
        return super.handleExceptionInternal(
                ex, Map.of("error", messagePour(ex, statusCode)), headers, statusCode, request);
    }

    // A deliberately coarse, client-facing message: enough to tell what went wrong, never the
    // framework's internal detail (this API is used by minors). Validation keeps its field detail.
    private static String messagePour(Exception ex, HttpStatusCode statusCode) {
        if (ex instanceof MethodArgumentNotValidException validation) {
            return validation.getBindingResult().getFieldErrors().stream()
                    .map(e -> e.getField() + ": " + e.getDefaultMessage())
                    .reduce((a, b) -> a + "; " + b)
                    .orElse("Validation error");
        }
        HttpStatus status = HttpStatus.resolve(statusCode.value());
        return switch (status == null ? HttpStatus.INTERNAL_SERVER_ERROR : status) {
            case NOT_FOUND -> "Introuvable";
            case METHOD_NOT_ALLOWED -> "Méthode non autorisée";
            case UNSUPPORTED_MEDIA_TYPE -> "Type de contenu non supporté";
            case NOT_ACCEPTABLE -> "Format non disponible";
            case PAYLOAD_TOO_LARGE -> "Requête trop volumineuse";
            default -> statusCode.is4xxClientError() ? "Requête invalide" : "Internal server error";
        };
    }

    // More specific than the superclass's ErrorResponseException handler, so a controller's
    // ResponseStatusException keeps its own status and reason rather than a generic message.
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<Map<String, String>> handleResponseStatus(ResponseStatusException ex) {
        String message = ex.getReason() != null ? ex.getReason() : "Erreur";
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", message));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, String>> handleUnexpected(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Internal server error"));
    }
}
