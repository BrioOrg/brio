package fr.brio.social;

import java.util.UUID;

/** Levée quand un fil d'entraide est introuvable. */
public class FilNotFoundException extends RuntimeException {

    public FilNotFoundException(UUID filId) {
        super("Fil introuvable : " + filId);
    }
}
