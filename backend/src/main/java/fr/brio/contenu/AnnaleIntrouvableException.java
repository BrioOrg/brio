package fr.brio.contenu;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.NOT_FOUND)
public class AnnaleIntrouvableException extends RuntimeException {
  public AnnaleIntrouvableException(String id) {
    super("Annale introuvable : " + id);
  }
}
