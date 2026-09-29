package fr.brio.devoirs;

/** Accès à une pièce refusé : ni l'élève auteur, ni l'enseignant du devoir. */
public class AccesPieceRefuseException extends RuntimeException {
    public AccesPieceRefuseException() {
        super("Accès à cette copie refusé.");
    }
}
