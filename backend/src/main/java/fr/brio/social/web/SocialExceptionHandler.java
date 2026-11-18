package fr.brio.social.web;

import fr.brio.social.AccesCommunauteRefuseException;
import fr.brio.social.AccesEntraideRefuseException;
import fr.brio.social.AccesMessagerieRefuseException;
import fr.brio.social.FilNotFoundException;
import fr.brio.social.MessageCommunauteNotFoundException;
import fr.brio.social.MessageInvalideException;
import fr.brio.social.MessageNotFoundException;
import fr.brio.social.PasModerateurException;
import fr.brio.social.QuestionDejaResolueException;
import fr.brio.social.SalonMessageNotFoundException;
import fr.brio.social.SalonNotFoundException;
import fr.brio.social.SousSanctionException;
import fr.brio.social.TropDeMessagesException;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Traduit les erreurs métier de l'entraide en réponses structurées (scopé au module). */
@RestControllerAdvice(basePackages = "fr.brio.social.web")
class SocialExceptionHandler {

    @ExceptionHandler({
        FilNotFoundException.class,
        MessageNotFoundException.class,
        SalonNotFoundException.class,
        SalonMessageNotFoundException.class,
        MessageCommunauteNotFoundException.class
    })
    ResponseEntity<Map<String, String>> introuvable(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler({
        AccesCommunauteRefuseException.class,
        AccesEntraideRefuseException.class,
        AccesMessagerieRefuseException.class,
        PasModerateurException.class,
        SousSanctionException.class
    })
    ResponseEntity<Map<String, String>> interdit(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(MessageInvalideException.class)
    ResponseEntity<Map<String, String>> invalide(MessageInvalideException ex) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(QuestionDejaResolueException.class)
    ResponseEntity<Map<String, String>> conflit(QuestionDejaResolueException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
    }

    /**
     * Deux écritures concurrentes sur le même contenu (verrou optimiste, V44) ou une contrainte
     * d'unicité franchie par une requête doublée (double clic) : la seconde est refusée proprement.
     */
    @ExceptionHandler({ObjectOptimisticLockingFailureException.class, DataIntegrityViolationException.class})
    ResponseEntity<Map<String, String>> conflit(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", "Ce contenu vient d'être modifié ailleurs. Recharge la page et réessaie."));
    }

    @ExceptionHandler(TropDeMessagesException.class)
    ResponseEntity<Map<String, String>> tropVite(TropDeMessagesException ex) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("error", ex.getMessage()));
    }
}
