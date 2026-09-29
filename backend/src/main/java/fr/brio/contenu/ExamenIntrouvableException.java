package fr.brio.contenu;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.NOT_FOUND)
public class ExamenIntrouvableException extends RuntimeException {
  public ExamenIntrouvableException(java.util.UUID id) {
    super("Session d'examen introuvable : " + id);
  }
}
