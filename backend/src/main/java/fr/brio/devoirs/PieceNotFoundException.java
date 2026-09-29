package fr.brio.devoirs;

import java.util.UUID;

/** La pièce demandée n'existe pas. */
public class PieceNotFoundException extends RuntimeException {
    public PieceNotFoundException(UUID id) {
        super("Pièce introuvable : " + id);
    }
}
