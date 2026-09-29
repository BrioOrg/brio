package fr.brio.devoirs;

/** Dépôt de copie refusé : type non autorisé, trop volumineux, trop de pièces, ou fichier illisible. */
public class PieceInvalideException extends RuntimeException {
    public PieceInvalideException(String message) {
        super(message);
    }
}
