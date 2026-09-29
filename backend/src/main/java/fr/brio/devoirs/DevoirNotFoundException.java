package fr.brio.devoirs;

import java.util.UUID;

public class DevoirNotFoundException extends RuntimeException {

    public DevoirNotFoundException(UUID id) {
        super("Devoir introuvable : " + id);
    }
}
